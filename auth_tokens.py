"""Simple token-based authentication for cross-origin requests"""
import secrets
import time
from typing import Optional, Dict

# In-memory token storage (in production, use Redis or database)
_tokens = {}  # {token: {user_data, expires_at}}

def generate_token(user_data: dict, expires_in: int = 86400) -> str:
    """Generate a secure random token and store user data"""
    token = secrets.token_urlsafe(32)
    _tokens[token] = {
        'user_data': user_data,
        'expires_at': time.time() + expires_in
    }
    return token

def verify_token(token: Optional[str]) -> Optional[dict]:
    """Verify token and return user data if valid"""
    if not token:
        return None
    
    token_data = _tokens.get(token)
    if not token_data:
        return None
    
    # Check if expired
    if time.time() > token_data['expires_at']:
        del _tokens[token]
        return None
    
    return token_data['user_data']

def revoke_token(token: str):
    """Revoke a token"""
    if token in _tokens:
        del _tokens[token]

def cleanup_expired_tokens():
    """Remove expired tokens"""
    current_time = time.time()
    expired = [token for token, data in _tokens.items() if current_time > data['expires_at']]
    for token in expired:
        del _tokens[token]

