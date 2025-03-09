from cachetools import TTLCache
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry
import time
import os
from dotenv import load_dotenv
import logging

load_dotenv()

# Ghost API Configuration
GHOST_URL = os.getenv('GHOST_URL')
GHOST_KEY = os.getenv('GHOST_CONTENT_API_KEY')
IS_PRODUCTION = os.getenv('FLASK_ENV') == 'production'

# Configure logging
logging.basicConfig(level=logging.DEBUG if not IS_PRODUCTION else logging.INFO)
logger = logging.getLogger(__name__)

# Single cache instance with shorter TTL
cache = TTLCache(maxsize=100, ttl=300)  # 5 minutes for all environments

# Configure retry strategy
retry_strategy = Retry(
    total=3,
    backoff_factor=1,
    status_forcelist=[429, 500, 502, 503, 504]
)

session = requests.Session()
adapter = HTTPAdapter(max_retries=retry_strategy)
session.mount("https://", adapter)
session.mount("http://", adapter)

def clear_cache():
    """Clear the entire cache"""
    cache.clear()
    logger.debug("Cache cleared")

def get_all_ghost_posts(force_refresh=False):
    """Get all posts from Ghost CMS with a single API call"""
    cache_key = "all_posts"
    
    if force_refresh:
        logger.debug("Force refresh requested, clearing cache")
        if cache_key in cache:
            del cache[cache_key]
    elif cache_key in cache:
        logger.debug("Returning cached posts")
        return cache[cache_key]
        
    if not GHOST_URL or not GHOST_KEY:
        logger.error("❌ Missing GHOST_URL or GHOST_KEY environment variables")
        return []
        
    # Use the URL structure that we know works
    api_url = f"{GHOST_URL}/ghost/api/content/posts/"
    params = {
        'key': GHOST_KEY,
        'include': 'tags,authors',
        'formats': 'html',
        'limit': 'all'
    }
    
    try:
        logger.debug(f"🔄 Fetching posts from: {api_url}")
        response = session.get(api_url, params=params)
        logger.debug(f"🔄 Full URL with params: {response.url}")
        logger.debug(f"🔄 API Response Status: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"❌ API Error Response: {response.text}")
            return []
            
        response.raise_for_status()
        data = response.json()
        posts = data.get('posts', [])
        logger.info(f"✅ Successfully fetched {len(posts)} posts")
        
        for post in posts:
            if post.get('feature_image'):
                post['feature_image'] = post['feature_image'].replace('/content/images/', '/content/images/size/w1000/')
        
        cache[cache_key] = posts
        return posts
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Error fetching Ghost posts: {str(e)}")
        logger.error(f"❌ Full error details: {e.__class__.__name__}")
        return cache.get(cache_key, [])

def get_ghost_posts(limit=None, tag=None, force_refresh=False):
    """Filter posts by tag from the cached collection"""
    all_posts = get_all_ghost_posts(force_refresh=force_refresh)
    
    if tag:
        filtered_posts = [
            post for post in all_posts 
            if any(t.get('slug') == tag for t in post.get('tags', []))
        ]
    else:
        filtered_posts = all_posts
    
    if limit:
        return filtered_posts[:limit]
    return filtered_posts

def get_ghost_post(slug, force_refresh=False):
    """Get a single post from the cached collection"""
    all_posts = get_all_ghost_posts(force_refresh=force_refresh)
    for post in all_posts:
        if post['slug'] == slug:
            return post
    return None

def get_case_studies(limit=None):
    """Get case studies from Ghost"""
    posts = get_ghost_posts(limit=limit, tag='case-studies')
    
    # Truncate excerpts to 120 characters and handle None values
    for post in posts:
        excerpt = post.get('excerpt') or ''  # Use empty string if excerpt is None
        if len(excerpt) > 120:
            post['excerpt'] = excerpt[:120].rstrip() + '...'
        else:
            post['excerpt'] = excerpt
    
    return posts

def get_next_post(current_post, tag=None):
    """Get next post in chronological order"""
    posts = get_ghost_posts(tag=tag)
    try:
        current_index = next(i for i, post in enumerate(posts) if post['slug'] == current_post['slug'])
        return posts[current_index + 1] if current_index + 1 < len(posts) else None
    except (StopIteration, IndexError):
        return None

def get_prev_post(current_post, tag=None):
    """Get previous post in chronological order"""
    posts = get_ghost_posts(tag=tag)
    try:
        current_index = next(i for i, post in enumerate(posts) if post['slug'] == current_post['slug'])
        return posts[current_index - 1] if current_index > 0 else None
    except (StopIteration, IndexError):
        return None

def get_ghost_page(slug):
    """Get a single page from Ghost with caching"""
    cache_key = f"page_{slug}"
    if cache_key in cache:
        return cache[cache_key]
        
    if not GHOST_URL or not GHOST_KEY:
        return None
        
    api_url = f"{GHOST_URL}/ghost/api/v5/content/pages/slug/{slug}"
    params = {
        'key': GHOST_KEY,
        'include': 'authors',
        'fields': 'title,slug,html,excerpt,published_at,feature_image'
    }
    
    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        pages = response.json().get('pages', [])
        page = pages[0] if pages else None
        if page:
            cache[cache_key] = page
        return page
    except Exception as e:
        print(f"❌ Ghost API error fetching page: {str(e)}")
        return None 