import os
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests
from functools import wraps
from flask import session, redirect, url_for, request, jsonify, g
from auth_tokens import verify_token

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5173/oauth2callback')

# OAuth flow configuration
SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']

def create_oauth_flow():
    """Create OAuth flow for Google authentication"""
    # Create client config dictionary
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI]
        }
    }
    
    # Create flow with explicit redirect URI
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES
    )
    
    # Set the redirect URI explicitly
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    
    return flow

def _resolve_user_from_request():
    """Resolve current user from session or bearer token and cache on flask.g"""
    if hasattr(g, 'current_user') and g.current_user:
        return g.current_user
    
    if 'user_id' in session:
        user = {
            'user_id': session['user_id'],
            'email': session.get('email'),
            'name': session.get('name'),
            'picture': session.get('picture')
        }
        g.current_user = user
        return user
    
    auth_header = request.headers.get('Authorization', '')
    token = None
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
    
    if token:
        token_user = verify_token(token)
        if token_user:
            g.current_user = token_user
            return token_user
    
    return None


def login_required(f):
    """Decorator to require login for protected routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = _resolve_user_from_request()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def get_user_info():
    """Get current user information from session"""
    return _resolve_user_from_request()

def verify_google_token(token):
    """Verify Google ID token"""
    try:
        print(f"\n=== Verifying Google Token ===")
        print(f"Token (first 50 chars): {token[:50] if token else 'None'}...")
        print(f"Client ID: {GOOGLE_CLIENT_ID}")
        
        # Verify token with clock skew tolerance (allows up to 10 seconds difference)
        idinfo = id_token.verify_oauth2_token(
            token, 
            requests.Request(), 
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10  # Tolerate clock differences up to 10 seconds
        )
        
        # ID token is valid. Get the user's Google Account ID and profile info
        userid = idinfo['sub']
        email = idinfo.get('email')
        name = idinfo.get('name')
        picture = idinfo.get('picture')
        
        print(f"✅ Token valid! User: {email}")
        print("============================\n")
        
        return {
            'user_id': userid,
            'email': email,
            'name': name,
            'picture': picture
        }
    except ValueError as e:
        print(f"❌ Token verification failed: {str(e)}")
        print("============================\n")
        return None
    except Exception as e:
        print(f"❌ Unexpected error verifying token: {str(e)}")
        print("============================\n")
        return None 