import os
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
from google.auth.transport import requests
from functools import wraps
from flask import session, redirect, url_for, request, jsonify

# Google OAuth configuration
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5000/oauth2callback')

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

def login_required(f):
    """Decorator to require login for protected routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def get_user_info():
    """Get current user information from session"""
    if 'user_id' in session:
        return {
            'user_id': session['user_id'],
            'email': session.get('email'),
            'name': session.get('name'),
            'picture': session.get('picture')
        }
    return None

def verify_google_token(token):
    """Verify Google ID token"""
    try:
        idinfo = id_token.verify_oauth2_token(
            token, 
            requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # ID token is valid. Get the user's Google Account ID and profile info
        userid = idinfo['sub']
        email = idinfo.get('email')
        name = idinfo.get('name')
        picture = idinfo.get('picture')
        
        return {
            'user_id': userid,
            'email': email,
            'name': name,
            'picture': picture
        }
    except ValueError:
        return None 