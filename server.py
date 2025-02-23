from flask import Flask, render_template, send_from_directory, request, redirect, session, url_for, abort, jsonify
from flask_compress import Compress
from cachetools import TTLCache
from datetime import datetime, timedelta
import os
from api_config import get_ghost_posts, get_case_studies, get_ghost_post, get_next_post, get_prev_post
import requests
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
import logging

load_dotenv()  # Add this near the top of server.py, before the GITHUB_TOKEN is used

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

# Add this to your configuration
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
GITHUB_USERNAME = 'outsidebryce'

logging.basicConfig(level=logging.DEBUG)

def get_github_contributions(token):
    # Calculate date range - ensure we get a full year including today
    end_date = datetime.now()
    start_date = end_date - timedelta(days=364)  # Change from 365 to 364 to include today
    
    query = """
    query($username:String!, $from:DateTime!, $to:DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
                date
                weekday
              }
            }
          }
        }
      }
    }
    """
    
    variables = {
        "username": "outsidebryce",
        "from": start_date.strftime("%Y-%m-%dT00:00:00"),  # Start at beginning of start date
        "to": end_date.strftime("%Y-%m-%dT23:59:59")       # End at end of end date
    }
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.post(
        'https://api.github.com/graphql',
        json={'query': query, 'variables': variables},
        headers=headers
    )
    
    if response.status_code == 200:
        data = response.json()
        logging.debug(f"Raw GitHub response: {data}")  # Add logging to see raw response
        
        calendar = data['data']['user']['contributionsCollection']['contributionCalendar']
        contributions = {
            'total': calendar['totalContributions'],
            'data': {}
        }
        
        # Process the contribution data
        for week in calendar['weeks']:
            for day in week['contributionDays']:
                date = datetime.fromisoformat(day['date'])
                days_from_end = (end_date - date).days
                week_number = days_from_end // 7
                weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.weekday()]
                key = f"{weekday}-{week_number}"
                contributions['data'][key] = day['contributionCount']
        
        logging.debug(f"Processed contributions: {contributions}")
        return contributions
    else:
        logging.error(f"GitHub API Error: {response.status_code}")
        return None

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
    
    github_contributions = get_github_contributions(GITHUB_TOKEN)
    
    return render_template('index.html',
                         ghost_posts=ghost_posts,
                         case_studies=case_studies,
                         playbook_items=playbook_items,
                         tech_stack_items=tech_stack_items,
                         github_contributions=github_contributions)

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
    
    return render_template('blog_post.html', 
                         post=post,
                         next_post=get_next_post(post, tag='case-studies'),
                         prev_post=get_prev_post(post, tag='case-studies'))

@app.route('/api/case-studies/<slug>')
def get_case_study_content(slug):
    """API endpoint for fetching case study content"""
    try:
        post = get_ghost_post(slug)
        if not post:
            return abort(404)
        
        return jsonify({
            'title': post['title'],
            'html': post['html'],
            'feature_image': post.get('feature_image'),
            'reading_time': post.get('reading_time', 0),  # Default to 0 if missing
            'published_at': post.get('published_at', ''),  # Default to empty string if missing
            'next_post': get_next_post(post, tag='case-studies'),
            'prev_post': get_prev_post(post, tag='case-studies')
        })
    except Exception as e:
        print(f"Error processing case study: {e}")
        return abort(500)

@app.route('/blog/<slug>')
def blog_post(slug):
    """Handle direct blog post URLs - SEO friendly"""
    post = get_ghost_post(slug)
    if not post:
        return abort(404)
    return render_template('blog_post.html', post=post)

@app.route('/api/posts/<slug>')
def get_post_content(slug):
    """API endpoint for fetching post content"""
    try:
        post = get_ghost_post(slug)
        if not post:
            return abort(404)
        
        return jsonify({
            'title': post['title'],
            'html': post['html'],
            'feature_image': post.get('feature_image'),
            'reading_time': post.get('reading_time', 0),  # Default to 0 if missing
            'published_at': post.get('published_at', ''),  # Default to empty string if missing
            'next_post': get_next_post(post),
            'prev_post': get_prev_post(post)
        })
    except Exception as e:
        print(f"Error processing post: {e}")
        return abort(500)

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