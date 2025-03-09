from flask import Flask, render_template, send_from_directory, request, redirect, session, url_for, abort, jsonify
from flask_compress import Compress
from datetime import datetime, timedelta
import os
from api_config import get_ghost_posts, get_case_studies, get_ghost_post, get_next_post, get_prev_post, get_ghost_page, get_all_ghost_posts, clear_cache
import requests
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
import logging
from jinja2 import TemplateNotFound

load_dotenv()

app = Flask(__name__)
Compress(app)

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
GHOST_API_URL = "https://bryce-thompson.ghost.io/ghost/api/content/posts/"

logging.basicConfig(level=logging.DEBUG)

def get_github_contributions(token):
    # Calculate date range - ensure we get a full year including today
    end_date = datetime.now()
    start_date = end_date - timedelta(days=364)  # Change from 365 to 364 to include today
    
    # Generate list of months for the contribution graph
    months = []
    current_date = end_date
    for _ in range(13):  # 13 months to account for partial months
        months.append(current_date.strftime('%b'))
        current_date = current_date.replace(day=1) - timedelta(days=1)  # Go to last day of previous month
    
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
            'data': {},
            'dates': {},
            'months': months  # Add months to the response
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
                # Add formatted date
                contributions['dates'][key] = date.strftime("%B %d, %Y")
        
        logging.debug(f"Processed contributions: {contributions}")
        return contributions
    else:
        logging.error(f"GitHub API Error: {response.status_code}")
        return None

@app.route('/')
def home():
    try:
        # Get all posts in one call, force refresh if requested
        force_refresh = request.args.get('refresh') == 'true'
        all_posts = get_all_ghost_posts(force_refresh=force_refresh)
        
        # Filter posts by tag and sort by published date
        news_posts = [p for p in all_posts if any(t.get('slug') == 'news' for t in p.get('tags', []))]
        news_posts.sort(key=lambda x: x.get('published_at', ''), reverse=True)  # Sort by date, newest first
        ghost_posts = news_posts[:3]  # Limit to 3 most recent posts
        
        playbook_items = [p for p in all_posts if any(t.get('slug') == 'playbook' for t in p.get('tags', []))]
        tech_stack_items = [p for p in all_posts if any(t.get('slug') == 'tech-stack' for t in p.get('tags', []))]
        
        # Get case studies separately since they're from a different source
        case_studies = get_case_studies(limit=6)
        
    except Exception as e:
        app.logger.error(f"❌ Error fetching posts: {str(e)}")
        ghost_posts = []
        case_studies = []
        playbook_items = []
        tech_stack_items = []
    
    github_contributions = get_github_contributions(GITHUB_TOKEN)
    
    return render_template('index.html', 
                         current_page='home',
                         ghost_posts=ghost_posts,
                         case_studies=case_studies,
                         playbook_items=playbook_items,
                         tech_stack_items=tech_stack_items,
                         github_contributions=github_contributions)

@app.route('/api/refresh-cache')
def refresh_cache():
    """Force refresh the Ghost posts cache"""
    try:
        clear_cache()
        get_all_ghost_posts(force_refresh=True)
        return jsonify({'status': 'success', 'message': 'Cache refreshed successfully'})
    except Exception as e:
        app.logger.error(f"Error refreshing cache: {str(e)}")
        return jsonify({'status': 'error', 'message': str(e)}), 500

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
        force_refresh = request.args.get('refresh') == 'true'
        post = get_ghost_post(slug) if not force_refresh else get_ghost_post(slug, force_refresh=True)
        if not post:
            return abort(404)
        
        response_data = {
            'title': post['title'],
            'html': post['html'],
            'feature_image': post.get('feature_image'),
            'reading_time': post.get('reading_time', 0),
            'published_at': post.get('published_at', ''),
            'next_post': get_next_post(post, tag='case-studies'),
            'prev_post': get_prev_post(post, tag='case-studies')
        }
        
        response = jsonify(response_data)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
        
    except Exception as e:
        app.logger.error(f"Error processing case study: {e}")
        return abort(500)

@app.route('/blog')
def blog():
    return render_template('blog.html', current_page='blog')

@app.route('/blog/<slug>')
def blog_post(slug):
    """Handle direct blog post URLs - SEO friendly"""
    post = get_ghost_post(slug)
    if not post:
        return abort(404)
    return render_template('blog_post.html', current_page='blog', post=post)

@app.route('/api/posts/<slug>')
def get_post_content(slug):
    """API endpoint for fetching post content"""
    try:
        force_refresh = request.args.get('refresh') == 'true'
        post = get_ghost_post(slug) if not force_refresh else get_ghost_post(slug, force_refresh=True)
        if not post:
            return abort(404)
        
        response_data = {
            'title': post['title'],
            'html': post['html'],
            'feature_image': post.get('feature_image'),
            'reading_time': post.get('reading_time', 0),
            'published_at': post.get('published_at', ''),
            'next_post': get_next_post(post),
            'prev_post': get_prev_post(post)
        }
        
        response = jsonify(response_data)
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response
        
    except Exception as e:
        app.logger.error(f"Error processing post: {e}")
        return abort(500)

@app.route('/api/chat', methods=['POST'])
async def chat():
    try:
        data = request.json
        message = data.get('message')
        
        # Get AI response using BryceAI
        ai_response = await bryce_ai.get_response(message)
        
        # Use environment variable for Voice ID
        VOICE_ID = os.getenv('ELEVEN_LABS_VOICE_ID')
        
        tts_response = requests.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}",
            headers={
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": os.getenv('ELEVEN_LABS_API_KEY')
            },
            json={
                "text": ai_response,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.5
                }
            }
        )
        
        if tts_response.status_code != 200:
            raise Exception(f"TTS API request failed: {tts_response.text}")
            
        # Add rate limiting and cleanup
        current_time = datetime.now()
        audio_filename = f"audio_{current_time.timestamp()}.mp3"
        audio_path = os.path.join(app.static_folder, 'audio', audio_filename)
        
        # Cleanup old audio files (keep last 24 hours)
        cleanup_old_audio_files()
        
        with open(audio_path, 'wb') as f:
            f.write(tts_response.content)
            
        return jsonify({
            'text': ai_response,
            'audioUrl': url_for('static', filename=f'audio/{audio_filename}')
        })
        
    except Exception as e:
        app.logger.error(f"Chat error: {str(e)}")
        return jsonify({'error': 'An error occurred processing your request'}), 500

def cleanup_old_audio_files():
    """Remove audio files older than 24 hours"""
    audio_dir = os.path.join(app.static_folder, 'audio')
    current_time = datetime.now()
    
    for filename in os.listdir(audio_dir):
        if not filename.endswith('.mp3'):
            continue
            
        file_path = os.path.join(audio_dir, filename)
        file_time = datetime.fromtimestamp(os.path.getctime(file_path))
        
        if current_time - file_time > timedelta(hours=24):
            try:
                os.remove(file_path)
            except Exception as e:
                app.logger.error(f"Error removing old audio file {filename}: {str(e)}")

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

@app.route('/ai-chat')
def ai_chat():
    return render_template('ai-chat.html')

@app.route('/<path>')
def dynamic_page(path):
    """Handle dynamic routing for pages like blog, about, contact"""
    try:
        # First try to get page as a Ghost page
        page = get_ghost_page(path)
        if page:
            return render_template('page.html', 
                                page=page, 
                                current_page=path)
        
        # If not found in Ghost, check if we have a static template
        if path in ['blog', 'about', 'contact']:
            # For blog, fetch posts
            if path == 'blog':
                ghost_posts = get_ghost_posts(limit=10)
                return render_template('blog.html', 
                                    posts=ghost_posts, 
                                    current_page='blog')
            
            # For about and contact, use static templates
            try:
                return render_template(f'{path}.html', 
                                    current_page=path)
            except TemplateNotFound:
                return abort(404)
        
        # If path doesn't match any content, 404
        return abort(404)
        
    except Exception as e:
        print(f"Error loading page {path}: {e}")
        return abort(500)

if __name__ == '__main__':
    # Use production server (gunicorn) in production
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port) 