from cachetools import TTLCache
import requests
import os
from dotenv import load_dotenv

load_dotenv()

# API Configuration
LINKEDIN_ACCESS_TOKEN = os.getenv('LINKEDIN_ACCESS_TOKEN')
DRIBBBLE_CLIENT_ID = os.getenv('DRIBBBLE_CLIENT_ID')
DRIBBBLE_CLIENT_SECRET = os.getenv('DRIBBBLE_CLIENT_SECRET')
DRIBBBLE_REDIRECT_URI = 'https://portfolio-site-dry-bush-8746.fly.dev/auth/dribbble/callback'

# Cache Configuration
linkedin_cache = TTLCache(maxsize=100, ttl=3600)  # 1 hour cache
dribbble_cache = TTLCache(maxsize=100, ttl=3600)

# Test data for development
SAMPLE_LINKEDIN_POSTS = [
    {
        "id": "test1",
        "text": "Just launched a new UX audit framework that helps teams identify usability issues 50% faster. Here's how we did it...",
    },
    {
        "id": "test2",
        "text": "5 key lessons from redesigning a healthcare platform that processes over 10,000 claims daily...",
    }
]

SAMPLE_DRIBBBLE_SHOTS = [
    {
        "id": 1,
        "title": "University of Miami Medicine",
        "description": "Helping cancer researchers perform custom clinical trials",
        "images": {
            "normal": "https://picsum.photos/400/300"
        },
        "tags": ["Healthcare", "UX Design", "Clinical"]
    },
    {
        "id": 2,
        "title": "Superior Biologics",
        "description": "Helping infusion centers process insurance claims faster",
        "images": {
            "normal": "https://picsum.photos/400/300"
        },
        "tags": ["Healthcare", "Claims", "Dashboard"]
    }
]

# Add after line 12
GHOST_URL = os.getenv('GHOST_URL')
GHOST_KEY = os.getenv('GHOST_CONTENT_API_KEY')

def get_linkedin_posts():
    """Get LinkedIn posts with fallback to sample data"""
    if not LINKEDIN_ACCESS_TOKEN:
        print("⚠️ Using sample LinkedIn data - no API token found")
        return SAMPLE_LINKEDIN_POSTS
        
    cache_key = 'linkedin_posts'
    if cache_key in linkedin_cache:
        return linkedin_cache[cache_key]
    
    url = 'https://api.linkedin.com/v2/ugcPosts'
    headers = {'Authorization': f'Bearer {LINKEDIN_ACCESS_TOKEN}'}
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise exception for bad status codes
        posts = response.json()
        linkedin_cache[cache_key] = posts
        print("✅ Successfully fetched LinkedIn posts")
        return posts
    except Exception as e:
        print(f"❌ LinkedIn API error: {e}")
        return SAMPLE_LINKEDIN_POSTS

def get_dribbble_auth_url():
    return f"https://dribbble.com/oauth/authorize?client_id={DRIBBBLE_CLIENT_ID}&redirect_uri={DRIBBBLE_REDIRECT_URI}&scope=public"

def get_dribbble_access_token(code):
    response = requests.post('https://dribbble.com/oauth/token', data={
        'client_id': DRIBBBLE_CLIENT_ID,
        'client_secret': DRIBBBLE_CLIENT_SECRET,
        'code': code,
        'redirect_uri': DRIBBBLE_REDIRECT_URI,
    })
    return response.json().get('access_token')

def get_dribbble_shots(access_token=None, limit=6):
    """Get Dribbble shots with a limit"""
    if not access_token:
        print("❌ No Dribbble access token found")
        return []
    
    headers = {'Authorization': f'Bearer {access_token}'}
    params = {'per_page': limit}
    
    try:
        response = requests.get('https://api.dribbble.com/v2/user/shots', 
                              headers=headers,
                              params=params)
        
        print(f"🔍 Dribbble API Response: {response.status_code}")
        
        if response.status_code == 200:
            shots = response.json()
            print(f"✅ Retrieved {len(shots)} Dribbble shots")
            return shots[:limit]
        else:
            print(f"❌ Dribbble API error: {response.status_code}")
            print(f"❌ Error details: {response.text}")
            return []
    except Exception as e:
        print(f"❌ Error fetching Dribbble shots: {str(e)}")
        return []

def get_dribbble_shots_fallback():
    """Get Dribbble shots with fallback to sample data"""
    if not DRIBBBLE_CLIENT_ID or not DRIBBBLE_CLIENT_SECRET:
        print("⚠️ Using sample Dribbble data - no client ID or secret found")
        return SAMPLE_DRIBBBLE_SHOTS
        
    cache_key = 'dribbble_shots_fallback'
    if cache_key in dribbble_cache:
        return dribbble_cache[cache_key]
    
    url = get_dribbble_auth_url()
    print(f"Redirect to Dribbble for authentication: {url}")
    return SAMPLE_DRIBBBLE_SHOTS

def get_ghost_posts(limit=None, tag=None):
    """Get posts from Ghost CMS"""
    ghost_url = os.getenv('GHOST_URL')
    ghost_key = os.getenv('GHOST_CONTENT_API_KEY')
    
    if not ghost_url or not ghost_key:
        return []
        
    api_url = f"{ghost_url}/ghost/api/v3/content/posts"
    params = {
        'key': ghost_key,
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
        # Modify feature_image URLs to request smaller sizes
        for post in posts:
            if post.get('feature_image'):
                post['feature_image'] = post['feature_image'].replace('/content/images/', '/content/images/size/w1000/')
        return posts
    except Exception as e:
        print(f"❌ Error fetching Ghost posts: {str(e)}")
        return []

def get_ghost_post(slug):
    """Get a single post from Ghost"""
    ghost_url = os.getenv('GHOST_URL')
    ghost_key = os.getenv('GHOST_CONTENT_API_KEY')
    
    if not ghost_url or not ghost_key:
        return None
        
    api_url = f"{ghost_url}/ghost/api/v3/content/posts/slug/{slug}"
    params = {
        'key': ghost_key,
        'include': 'tags,authors',
        'fields': 'title,slug,html,excerpt,published_at,reading_time,url,feature_image'
    }
    
    try:
        response = requests.get(api_url, params=params)
        response.raise_for_status()
        posts = response.json().get('posts', [])
        if posts and posts[0].get('feature_image'):
            # Modify the feature_image URL to request a smaller size
            posts[0]['feature_image'] = posts[0]['feature_image'].replace('/content/images/', '/content/images/size/w1000/')
        return posts[0] if posts else None
    except Exception as e:
        print(f"❌ Ghost API error: {str(e)}")
        return None

def get_next_post(current_post, tag=None):
    """Get the next most recent post"""
    posts = get_ghost_posts(limit=10, tag=tag)
    for i, post in enumerate(posts):
        if post['slug'] == current_post['slug'] and i > 0:
            return posts[i-1]
    return None

def get_prev_post(current_post, tag=None):
    """Get the previous (older) post"""
    posts = get_ghost_posts(limit=10, tag=tag)
    for i, post in enumerate(posts):
        if post['slug'] == current_post['slug'] and i < len(posts) - 1:
            return posts[i+1]
    return None

def get_case_studies(limit=6):
    """Get case study posts from Ghost"""
    return get_ghost_posts(limit=limit, tag='case-studies') 