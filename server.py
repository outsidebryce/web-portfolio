from flask import Flask, render_template, send_from_directory, request, redirect, session, url_for, abort
from flask_compress import Compress
from cachetools import TTLCache
from datetime import datetime, timedelta
import os
from api_config import get_ghost_posts, get_case_studies, get_ghost_post, get_next_post, get_prev_post

app = Flask(__name__)
Compress(app)

# Cache configuration
cache = TTLCache(maxsize=100, ttl=3600)  # Cache for 1 hour

# Sample data
PLAYBOOK = [
    "UX Audit & Scorecard",
    "Remote Workshop",
    "North Star Vision",
    "Userflow Diagramming",
    "Customer Journey Mapping",
    "Experimentation & Testing",
    "Implementation Support",
    "Design System Augmentation"
]

TECH_STACK = [
    "Figma",
    "Miro",
    "Maze",
    "Notion",
    "Zapier",
    "Ollama AI",
    "Linux Mint",
    "Element"
]

@app.route('/')
def home():
    ghost_posts = []
    case_studies = []
    playbook_items = []
    tech_stack_items = []
    
    try:
        # Get posts for each tag
        ghost_posts = get_ghost_posts(limit=5, tag='news')
        case_studies = get_case_studies(limit=6)
        playbook_items = get_ghost_posts(limit=None, tag='playbook')
        tech_stack_items = get_ghost_posts(limit=None, tag='tech-stack')
    except Exception as e:
        print(f"❌ Error fetching posts: {str(e)}")
    
    return render_template('index.html',
                         ghost_posts=ghost_posts,
                         case_studies=case_studies,
                         playbook_items=playbook_items,
                         tech_stack_items=tech_stack_items)

@app.route('/debug/linkedin')
def debug_linkedin():
    """Debug endpoint to view LinkedIn API response"""
    posts = get_linkedin_posts()
    return {
        'post_count': len(posts),
        'posts': posts,
        'using_sample_data': not bool(os.getenv('LINKEDIN_ACCESS_TOKEN'))
    }

@app.route('/debug/dribbble')
def debug_dribbble():
    """Debug endpoint to view Dribbble API response"""
    shots = get_dribbble_shots()
    return {
        'shot_count': len(shots),
        'shots': shots,
        'using_sample_data': not bool(os.getenv('DRIBBBLE_ACCESS_TOKEN'))
    }

@app.route('/auth/dribbble')
def dribbble_auth():
    return redirect(get_dribbble_auth_url())

@app.route('/auth/dribbble/callback')
def dribbble_callback():
    code = request.args.get('code')
    if code:
        access_token = get_dribbble_access_token(code)
        # Store this token securely - for now we'll use fly.io secrets
        # You should get this token and set it using:
        # flyctl secrets set DRIBBBLE_ACCESS_TOKEN="your_access_token"
        return f"Access Token: {access_token}"
    return "Authentication failed"

@app.route('/case-studies/<slug>')
def case_study_post(slug):
    """Handle direct case study post URLs"""
    post = get_ghost_post(slug)
    if not post:
        return abort(404)
    
    # Regular page load
    return render_template('blog_post.html', post=post,
                         next_post=get_next_post(post, tag='case-studies'),
                         prev_post=get_prev_post(post, tag='case-studies'))

@app.route('/api/case-studies/<slug>')
def get_case_study_content(slug):
    """API endpoint for fetching case study content"""
    post = get_ghost_post(slug)
    if not post:
        return abort(404)
    return render_template('components/post_overlay.html',
                         post=post,
                         next_post=get_next_post(post, tag='case-studies'),
                         prev_post=get_prev_post(post, tag='case-studies'))

@app.route('/blog/<slug>')
def blog_post(slug):
    """Handle direct blog post URLs - SEO friendly"""
    post = get_ghost_post(slug)
    if not post:
        return abort(404)
    return render_template('blog_post.html', post=post)

@app.route('/api/posts/<slug>')
def get_post_content(slug):
    """API endpoint for fetching blog post content"""
    post = get_ghost_post(slug)
    if not post:
        return abort(404)
    return render_template('components/post_overlay.html',
                         post=post,
                         next_post=get_next_post(post, tag='news'),
                         prev_post=get_prev_post(post, tag='news'))

@app.after_request
def add_cache_headers(response):
    """Add cache headers to static assets"""
    if request.path.startswith('/static/'):
        # Cache static files for 30 days
        response.cache_control.max_age = 2592000
        response.cache_control.public = True
        response.headers['Vary'] = 'Accept-Encoding'
        
        # Add expires header
        expires = datetime.now() + timedelta(seconds=2592000)
        response.headers['Expires'] = expires.strftime('%a, %d %b %Y %H:%M:%S GMT')
    return response

if __name__ == '__main__':
    # Use production server (gunicorn) in production
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port) 