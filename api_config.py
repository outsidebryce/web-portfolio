from cachetools import TTLCache
import requests
import os
from dotenv import load_dotenv

load_dotenv()

# Ghost API Configuration
GHOST_URL = os.getenv('GHOST_URL')
GHOST_KEY = os.getenv('GHOST_CONTENT_API_KEY')

def get_ghost_posts(limit=None, tag=None):
    """Get posts from Ghost CMS"""
    if not GHOST_URL or not GHOST_KEY:
        return []
        
    api_url = f"{GHOST_URL}/ghost/api/v3/content/posts"
    params = {
        'key': GHOST_KEY,
        'include': 'tags,authors',
        'fields': 'title,slug,html,excerpt,published_at,reading_time,url,feature_image',
        'limit': limit
    }
    
    if tag:
        params['filter'] = f'tag:{tag}'
    
    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        posts = response.json().get('posts', [])
        for post in posts:
            if post.get('feature_image'):
                post['feature_image'] = post['feature_image'].replace('/content/images/', '/content/images/size/w1000/')
        return posts
    except Exception as e:
        print(f"❌ Error fetching Ghost posts: {str(e)}")
        return []

def get_ghost_post(slug):
    """Get a single post from Ghost"""
    if not GHOST_URL or not GHOST_KEY:
        return None
        
    api_url = f"{GHOST_URL}/ghost/api/v3/content/posts/slug/{slug}"
    params = {
        'key': GHOST_KEY,
        'include': 'tags,authors',
        'fields': 'title,slug,html,excerpt,published_at,reading_time,url,feature_image'
    }
    
    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        posts = response.json().get('posts', [])
        if posts and posts[0].get('feature_image'):
            posts[0]['feature_image'] = posts[0]['feature_image'].replace('/content/images/', '/content/images/size/w1000/')
        return posts[0] if posts else None
    except Exception as e:
        print(f"❌ Ghost API error: {str(e)}")
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