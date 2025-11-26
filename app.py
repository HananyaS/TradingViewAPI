import io
import json
import math
import os
import threading
import time
import urllib.parse
from collections import defaultdict
from datetime import datetime

import pandas as pd
import requests
from bson import ObjectId
from flask import Flask, request, jsonify, send_file, session, redirect
from flask_cors import CORS
from pydantic import ValidationError
import smtplib
from email.mime.text import MIMEText

from auth_tokens import generate_token, verify_token, revoke_token
from filter_schemas import ScreenerRequest, ScreenerResponse, FieldMetadata
from filter_serializer import FilterSerializer
from google_oauth import create_oauth_flow, login_required, get_user_info, verify_google_token
from mongodb_config import mongodb_manager
from react_routes import register_react_routes
from screener_service import query_by_params, fetch_symbol_quotes

# Load environment variables from .env file for local development
try:
    from dotenv import load_dotenv

    load_dotenv()
    print("✅ Loaded environment variables from .env file")
except ImportError:
    print("⚠️ python-dotenv not installed. Install with: pip install python-dotenv")
except FileNotFoundError:
    print("⚠️ .env file not found. Run: python local_setup.py")

# Check if we're in production
IS_PRODUCTION = os.getenv('FLASK_ENV') == 'production' or os.getenv('RENDER') == 'true' or os.path.exists(
    'static/dist/index.html')

# Allow OAuth2 to work with HTTP for local development only
if not IS_PRODUCTION:
    os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__, static_folder='static/dist' if IS_PRODUCTION else 'static')
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-change-this')

# Configure CORS
if IS_PRODUCTION:
    # Production: Allow requests from the Render domain
    render_url = os.getenv('RENDER_EXTERNAL_URL', '')
    CORS(app, supports_credentials=True, origins=[render_url] if render_url else None)
else:
    # Development: Allow requests from React dev server
    CORS(app, supports_credentials=True, origins=['http://localhost:5173'])

# Configure session cookie settings 
if IS_PRODUCTION:
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_SECURE'] = True  # HTTPS in production
    app.config['SESSION_COOKIE_HTTPONLY'] = True  # Secure in production
    app.config['SESSION_COOKIE_DOMAIN'] = None  # Let Flask determine domain
else:
    app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
    app.config['SESSION_COOKIE_SECURE'] = False  # HTTP for localhost
    app.config['SESSION_COOKIE_HTTPONLY'] = False  # Allow JS access for debugging
    app.config['SESSION_COOKIE_DOMAIN'] = 'localhost'

app.config['SESSION_COOKIE_PATH'] = '/'
app.config['SESSION_COOKIE_NAME'] = 'session'
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours
app.config['SESSION_REFRESH_EACH_REQUEST'] = False

# Initialize filter serializer with field metadata
_filter_serializer = None

register_react_routes(app)

# Email alert configuration
ALERT_EMAIL_SENDER = os.getenv('ALERT_EMAIL_SENDER')
SMTP_SERVER = os.getenv('SMTP_SERVER')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USERNAME = os.getenv('SMTP_USERNAME')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'true').lower() == 'true'
EMAIL_NOTIFICATIONS_ENABLED = bool(ALERT_EMAIL_SENDER and SMTP_SERVER)
ALERT_NOTIFICATION_METHODS = {'in_app', 'email', 'both'}


def get_filter_serializer():
    """Get or create the filter serializer with field metadata"""
    global _filter_serializer
    if _filter_serializer is None:
        try:
            import json
            with open('static/fields.json', 'r') as f:
                fields_data = json.load(f)

            field_metadata = {
                field['Name']: FieldMetadata(**field)
                for field in fields_data['fields']
            }
            _filter_serializer = FilterSerializer(field_metadata)
        except Exception as e:
            print(f"❌ Error loading field metadata: {e}")
            _filter_serializer = FilterSerializer({})

    return _filter_serializer


def _should_send_email(notification_method: str) -> bool:
    """Check if the alert's notification method includes email delivery"""
    if not notification_method:
        return False
    return notification_method in ('email', 'both')


def send_alert_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email notification if SMTP is configured"""
    if not EMAIL_NOTIFICATIONS_ENABLED or not to_email:
        return False

    try:
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = ALERT_EMAIL_SENDER
        msg['To'] = to_email

        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.sendmail(ALERT_EMAIL_SENDER, [to_email], msg.as_string())

        return True
    except Exception as e:
        print(f"Error sending alert email: {e}")
        return False


@app.route('/api/test-filter', methods=['POST'])
def test_filter():
    """Test endpoint for debugging filter issues"""
    try:
        # Create a simple test request
        from filter_schemas import ScreenerRequest, FilterGroup, FilterRule, FilterOperand, OperatorType, \
            LogicalOperator

        # Create a simple rule: close > 10
        rule = FilterRule(
            id="test_rule_1",
            left_operand=FilterOperand(type="field", value="close"),
            operator=OperatorType.GREATER_THAN,
            right_operand=FilterOperand(type="constant", value=10.0),
            enabled=True
        )

        # Create filter group
        group = FilterGroup(
            id="test_group_1",
            logical_operator=LogicalOperator.AND,
            rules=[rule],
            nested_groups=[],
            enabled=True
        )

        # Create screener request
        request = ScreenerRequest(
            filter_groups=[group],
            columns=None,  # Use defaults
            # limit=100,
            sort_by="market_cap_basic",
            sort_ascending=False
        )

        # Get filter serializer
        serializer = get_filter_serializer()

        # Try to serialize
        query = serializer.serialize_screener_request(request)

        # Try to execute
        columns, results_df = query.get_scanner_data()

        return jsonify({
            'success': True,
            'message': 'Test filter worked successfully',
            'count': len(results_df),
            'columns': list(columns) if columns else []
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Test filter failed: {str(e)}'
        }), 500


def get_frontend_url():
    """Get frontend URL based on environment"""
    if IS_PRODUCTION:
        render_url = os.getenv('RENDER_EXTERNAL_URL', '')
        return render_url if render_url else request.url_root.rstrip('/')
    else:
        return 'http://localhost:5173'


@app.route('/login')
def login():
    """Initiate Google OAuth login"""
    try:
        # Determine redirect URI for OAuth
        if IS_PRODUCTION:
            render_url = os.getenv('RENDER_EXTERNAL_URL', '')
            if render_url:
                redirect_uri = f"{render_url}/oauth2callback"
            else:
                # Construct from request
                redirect_uri = f"{request.scheme}://{request.host}/oauth2callback"
                redirect_uri = redirect_uri
        else:
            redirect_uri = None  # Use default from google_oauth.py

        flow = create_oauth_flow(redirect_uri)
        authorization_url, state = flow.authorization_url()
        session['state'] = state
        print(f"Redirecting to: {authorization_url}")
        return redirect(authorization_url)
    except Exception as e:
        print(f"Login error: {e}")
        frontend_url = get_frontend_url()
        return redirect(f'{frontend_url}/login?error=Login+error:+{str(e)}')


@app.route('/oauth2callback')
def oauth2callback():
    """Handle Google OAuth callback"""
    try:

        # Determine redirect URI for OAuth callback
        if IS_PRODUCTION:
            render_url = os.getenv('RENDER_EXTERNAL_URL', '')
            if render_url:
                redirect_uri = f"{render_url}/oauth2callback"
            else:
                redirect_uri = f"{request.scheme}://{request.host}/oauth2callback"
        else:
            redirect_uri = None  # Use default

        flow = create_oauth_flow(redirect_uri)
        flow.fetch_token(authorization_response=request.url)

        # Get user info from Google
        credentials = flow.credentials

        id_info = verify_google_token(credentials.id_token)

        if id_info:
            # Record or get user (tracks first login date)
            user_profile = mongodb_manager.get_or_create_user(
                user_id=id_info['user_id'],
                email=id_info['email'],
                name=id_info['name'],
                picture=id_info.get('picture', '')
            )

            # Store user info in session
            session.clear()  # Clear any old session data first
            session['user_id'] = id_info['user_id']
            session['email'] = id_info['email']
            session['name'] = id_info['name']
            session['picture'] = id_info['picture']
            session['authenticated'] = True
            session.permanent = True  # Make session persistent
            session.modified = True  # Force session to be saved

            # Generate authentication token (bypasses cookie issues!)
            token = generate_token({
                'user_id': id_info['user_id'],
                'email': id_info['email'],
                'name': id_info['name'],
                'picture': id_info['picture']
            })

            # Redirect to React with token in URL (React will capture and store it)
            frontend_url = get_frontend_url()
            return redirect(f'{frontend_url}/?auth_token={token}')
        else:
            frontend_url = get_frontend_url()
            return redirect(f'{frontend_url}/login?error=Invalid+Google+token')

    except Exception as e:
        error_msg = f'OAuth Error: {str(e)}'
        print(f"OAuth Error: {e}")
        frontend_url = get_frontend_url()
        return redirect(f'{frontend_url}/login?error={error_msg}')


@app.route('/logout', methods=['POST'])
def logout():
    """Logout user (revoke token)"""
    # Get token from Authorization header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
        revoke_token(token)
        print(f"🔓 Token revoked")

    session.clear()
    return jsonify({'success': True, 'message': 'Logged out'})


@app.route('/api/user')
def get_user():
    """Get current user information (token-based auth)"""
    # Check for Authorization header with token
    auth_header = request.headers.get('Authorization', '')
    token = None

    if auth_header.startswith('Bearer '):
        token = auth_header[7:]  # Remove 'Bearer ' prefix

    # Verify token
    user_data = verify_token(token)

    if user_data:
        return jsonify({
            'authenticated': True,
            'user_id': user_data['user_id'],
            'email': user_data['email'],
            'name': user_data['name'],
            'picture': user_data['picture']
        })
    else:
        return jsonify({'authenticated': False})


@app.route('/api/profile', methods=['GET'])
@login_required
def get_user_profile():
    """Get user profile with member since date"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        profile = mongodb_manager.get_user_profile(user_id)
        if profile:
            return jsonify({
                'success': True,
                'profile': profile
            })
        else:
            # Return basic info if profile doesn't exist yet
            return jsonify({
                'success': True,
                'profile': {
                    'user_id': user_id,
                    'email': user_info.get('email'),
                    'name': user_info.get('name'),
                    'picture': user_info.get('picture'),
                    'first_login_date': None
                }
            })
    except Exception as e:
        print(f"Error getting user profile: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/profile', methods=['PUT'])
@login_required
def update_user_profile():
    """Update user profile (name, picture)"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        data = request.get_json() or {}
        profile_data = {}

        if 'name' in data:
            profile_data['name'] = data['name']
        if 'picture' in data:
            profile_data['picture'] = data['picture']

        if not profile_data:
            return jsonify({'success': False, 'error': 'No fields to update'})

        success = mongodb_manager.update_user_profile(user_id, profile_data)
        if success:
            updated_profile = mongodb_manager.get_user_profile(user_id)
            if updated_profile:
                # Ensure all ObjectIds are converted to strings
                if '_id' in updated_profile and isinstance(updated_profile['_id'], ObjectId):
                    updated_profile['_id'] = str(updated_profile['_id'])
                return jsonify({
                    'success': True,
                    'message': 'Profile updated successfully',
                    'profile': updated_profile
                })
            else:
                # Return basic info if profile doesn't exist
                return jsonify({
                    'success': True,
                    'message': 'Profile updated successfully',
                    'profile': {
                        'user_id': user_id,
                        'email': user_info.get('email'),
                        'name': profile_data.get('name', user_info.get('name')),
                        'picture': profile_data.get('picture', user_info.get('picture')),
                        'first_login_date': None
                    }
                })
        else:
            return jsonify({'success': False, 'error': 'Failed to update profile'})
    except Exception as e:
        print(f"Error updating profile: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/profile/stats', methods=['GET'])
@login_required
def get_user_stats():
    """Get user activity statistics"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        stats = mongodb_manager.get_user_stats(user_id)
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        print(f"Error getting user stats: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/profile', methods=['DELETE'])
@login_required
def delete_user_account():
    """Delete user account and all associated data"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        deleted_counts = mongodb_manager.delete_all_user_data(user_id)
        if deleted_counts:
            # Clear session
            session.clear()
            return jsonify({
                'success': True,
                'message': 'Account deleted successfully',
                'deleted_counts': deleted_counts
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to delete account'})
    except Exception as e:
        print(f"Error deleting account: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/journal/trades', methods=['GET'])
@login_required
def get_user_trades():
    """Get trades for the current user"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        trades = mongodb_manager.get_user_trades(user_id)
        return jsonify({
            'success': True,
            'trades': trades
        })
    except Exception as e:
        print(f"Error getting user trades: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/journal/trades', methods=['POST'])
@login_required
def save_user_trade():
    """Save a trade for the current user"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        data = request.get_json() or {}

        # Validate required fields
        required_fields = ['symbol', 'type', 'price', 'quantity', 'date']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'success': False, 'error': f'Missing required field: {field}'})

        # Prepare trade data
        trade_data = {
            'symbol': data['symbol'].upper(),
            'type': data['type'],
            'price': float(data['price']),
            'quantity': int(data['quantity']),
            'date': data['date'],
            'notes': data.get('notes', ''),
            'strategy': data.get('strategy'),
            'exit_price': None if data.get('exit_price') in (None, '', 'null') else float(data['exit_price']),
            'screenerId': data.get('screenerId'),
            'timestamp': datetime.utcnow().isoformat()
        }

        # Save trade to MongoDB
        trade_id = mongodb_manager.save_trade(user_id, trade_data)

        if trade_id:
            return jsonify({
                'success': True,
                'message': 'Trade saved successfully',
                'trade_id': trade_id
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to save trade'})

    except Exception as e:
        print(f"Error saving trade: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/journal/trades/<trade_id>', methods=['DELETE'])
@login_required
def delete_user_trade(trade_id):
    """Delete a trade for the current user"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        success = mongodb_manager.delete_trade(user_id, trade_id)
        if success:
            return jsonify({'success': True, 'message': 'Trade deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Trade not found or could not be deleted'})
    except Exception as e:
        print(f"Error deleting trade: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/journal/trades/<trade_id>', methods=['PUT'])
@login_required
def update_user_trade(trade_id):
    """Update a trade for the current user"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        data = request.get_json()

        # Prepare trade data for update
        trade_data = {}
        if 'symbol' in data:
            trade_data['symbol'] = data['symbol'].upper()
        if 'type' in data:
            trade_data['type'] = data['type']
        if 'price' in data:
            trade_data['price'] = float(data['price'])
        if 'quantity' in data:
            trade_data['quantity'] = int(data['quantity'])
        if 'date' in data:
            trade_data['date'] = data['date']
        if 'notes' in data:
            trade_data['notes'] = data['notes']
        if 'strategy' in data:
            trade_data['strategy'] = data['strategy']
        if 'screenerId' in data:
            trade_data['screenerId'] = data['screenerId']
        if 'exit_price' in data:
            exit_value = data['exit_price']
            trade_data['exit_price'] = None if exit_value is None else float(exit_value)

        success = mongodb_manager.update_trade(user_id, trade_id, trade_data)
        if success:
            updated_trade = mongodb_manager.get_trade_by_id(user_id, trade_id)
            return jsonify({
                'success': True,
                'message': 'Trade updated successfully',
                'trade': updated_trade
            })
        else:
            return jsonify({'success': False, 'error': 'Trade not found or could not be updated'})
    except Exception as e:
        print(f"Error updating trade: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/watchlist/items', methods=['GET'])
@login_required
def get_user_watchlist():
    """Get watchlist items for the current user"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        items = mongodb_manager.get_user_watchlist(user_id)
        return jsonify({
            'success': True,
            'items': items
        })
    except Exception as e:
        print(f"Error getting user watchlist: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/watchlist/items', methods=['POST'])
@login_required
def save_user_watchlist_item():
    """Save a watchlist item for the current user"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        data = request.get_json()

        # Validate required fields
        if 'symbol' not in data or not data['symbol']:
            return jsonify({'success': False, 'error': 'Missing required field: symbol'})

        # Prepare item data
        item_data = {
            'symbol': data['symbol'].upper(),
            'notes': data.get('notes', ''),
            'target_price': data.get('target_price'),
            'stop_loss': data.get('stop_loss'),
            'timestamp': datetime.utcnow().isoformat()
        }

        # Save watchlist item to MongoDB
        item_id = mongodb_manager.save_watchlist_item(user_id, item_data)

        if item_id:
            return jsonify({
                'success': True,
                'message': 'Watchlist item saved successfully',
                'item_id': item_id
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to save watchlist item'})

    except Exception as e:
        print(f"Error saving watchlist item: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/watchlist/items/<item_id>', methods=['DELETE'])
@login_required
def delete_user_watchlist_item(item_id):
    """Delete a watchlist item for the current user"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        success = mongodb_manager.delete_watchlist_item(user_id, item_id)
        if success:
            return jsonify({'success': True, 'message': 'Watchlist item deleted successfully'})
        else:
            return jsonify({'success': False, 'error': 'Watchlist item not found or could not be deleted'})
    except Exception as e:
        print(f"Error deleting watchlist item: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/watchlist/items/<item_id>', methods=['PUT'])
@login_required
def update_user_watchlist_item(item_id):
    """Update a watchlist item for the current user"""
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'error': 'Authentication required'}), 401
    user_id = user_info['user_id']
    try:
        data = request.get_json()

        # Prepare item data for update
        item_data = {}
        if 'symbol' in data:
            item_data['symbol'] = data['symbol'].upper()
        if 'notes' in data:
            item_data['notes'] = data['notes']
        if 'target_price' in data:
            item_data['target_price'] = data['target_price']
        if 'stop_loss' in data:
            item_data['stop_loss'] = data['stop_loss']

        success = mongodb_manager.update_watchlist_item(user_id, item_id, item_data)
        if success:
            return jsonify({'success': True, 'message': 'Watchlist item updated successfully'})
        else:
            return jsonify({'success': False, 'error': 'Watchlist item not found or could not be updated'})
    except Exception as e:
        print(f"Error updating watchlist item: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/query/list', methods=['GET'])
@login_required
def list_saved_queries():
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    queries = mongodb_manager.get_user_queries(user_info['user_id'])
    return jsonify({'success': True, 'queries': queries})


@app.route('/api/query/save', methods=['POST'])
@login_required
def save_user_query_route():
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    filters = data.get('filters')
    if not name:
        return jsonify({'success': False, 'message': 'Query name is required'}), 400
    if not filters or not isinstance(filters, dict):
        return jsonify({'success': False, 'message': 'Filters payload is required'}), 400
    query_payload = {
        'name': name,
        'description': (data.get('description') or '').strip(),
        'filters': filters,
        'is_favorite': bool(data.get('is_favorite')),
        'owner_name': user_info.get('name'),
        'owner_email': user_info.get('email')
    }
    query_id = mongodb_manager.save_user_query(user_info['user_id'], query_payload)
    if not query_id:
        return jsonify({'success': False, 'message': 'Failed to save query'}), 500
    return jsonify({'success': True, 'query_id': query_id})


@app.route('/api/query/load/<query_id>', methods=['GET'])
@login_required
def load_user_query(query_id):
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    query = mongodb_manager.get_user_query(user_info['user_id'], query_id)
    if not query:
        return jsonify({'success': False, 'message': 'Query not found'}), 404
    return jsonify({'success': True, 'query': query})


@app.route('/api/query/delete/<query_id>', methods=['DELETE'])
@login_required
def delete_user_query_route(query_id):
    user_info = get_user_info()
    if not user_info:
        return jsonify({'success': False, 'message': 'Authentication required'}), 401
    success = mongodb_manager.delete_user_query(user_info['user_id'], query_id)
    if success:
        return jsonify({'success': True})
    return jsonify({'success': False, 'message': 'Query not found'}), 404


@app.route('/api/prices/cache', methods=['GET'])
def get_cached_prices():
    """Get cached prices for symbols"""
    try:
        symbols = request.args.getlist('symbols[]')
        if not symbols:
            return jsonify({'success': False, 'error': 'No symbols provided'})

        # Get cached prices from MongoDB
        cached_prices = {}
        for symbol in symbols:
            price_doc = mongodb_manager.get_price_cache(symbol)
            if price_doc:
                cached_prices[symbol] = {
                    'current': price_doc['current_price'],
                    'change': price_doc['change'],
                    'changePercent': price_doc['change_percent'],
                    'lastUpdate': price_doc['last_update'].isoformat()
                }

        return jsonify({
            'success': True,
            'prices': cached_prices
        })
    except Exception as e:
        print(f"Error getting cached prices: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/prices/cache', methods=['POST'])
def update_cached_prices():
    """Update cached prices for symbols"""
    try:
        data = request.get_json()
        prices = data.get('prices', {})

        # Update cached prices in MongoDB
        for symbol, price_data in prices.items():
            mongodb_manager.update_price_cache(
                symbol=symbol,
                current_price=price_data['current'],
                change=price_data['change'],
                change_percent=price_data['changePercent']
            )

        return jsonify({
            'success': True,
            'message': f'Updated {len(prices)} price(s)'
        })
    except Exception as e:
        print(f"Error updating cached prices: {e}")
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/prices/fetch', methods=['POST'])
def fetch_live_prices():
    """Fetch live prices for symbols using TradingView API"""
    try:
        data = request.get_json()
        symbols = data.get('symbols', [])

        if not symbols:
            return jsonify({'success': False, 'error': 'No symbols provided'})

        # Fetch live prices using TradingView screener
        live_prices = fetch_symbol_quotes(symbols)

        # Cache the prices
        for symbol, price_data in live_prices.items():
            if price_data:
                mongodb_manager.update_price_cache(
                    symbol=symbol,
                    current_price=price_data['current'],
                    change=price_data['change'],
                    change_percent=price_data['changePercent']
                )
            else:
                print(f"[prices.fetch] No price data returned for {symbol}")

        return jsonify({
            'success': True,
            'prices': live_prices
        })
    except Exception as e:
        print(f"Error fetching live prices: {e}")
        return jsonify({'success': False, 'error': str(e)})


# Rate limiting for TickerTick API (10 requests per minute per IP)
_tickertick_rate_limit = {}


def _check_tickertick_rate_limit():
    """Check if we can make a request to TickerTick API"""
    global _tickertick_rate_limit
    current_time = time.time()

    # Clean old entries (older than 1 minute)
    _tickertick_rate_limit = {
        ip: timestamps
        for ip, timestamps in _tickertick_rate_limit.items()
        if any(ts > current_time - 60 for ts in timestamps)
    }

    # Get client IP
    client_ip = request.remote_addr or 'unknown'

    # Get timestamps for this IP
    timestamps = _tickertick_rate_limit.get(client_ip, [])

    # Remove timestamps older than 1 minute
    timestamps = [ts for ts in timestamps if ts > current_time - 60]

    # Check if we've exceeded the limit
    if len(timestamps) >= 10:
        return False, 60 - (current_time - min(timestamps))

    # Add current timestamp
    timestamps.append(current_time)
    _tickertick_rate_limit[client_ip] = timestamps

    return True, 0


def _check_user_news_rate_limit(user_id):
    """Check if user can fetch news (once per minute per user)"""
    try:
        last_fetch = mongodb_manager.get_user_last_news_fetch(user_id)
        if last_fetch:
            from datetime import timedelta
            time_since_last = datetime.utcnow() - last_fetch
            if time_since_last < timedelta(minutes=1):
                wait_seconds = 60 - int(time_since_last.total_seconds())
                return False, wait_seconds
        return True, 0
    except Exception as e:
        print(f"[news] Error checking user rate limit: {e}")
        return True, 0


def _build_tickertick_query(tickers=None, story_type=None):
    """Build TickerTick query string from list of tickers or story type"""
    if story_type:
        # Story type query (e.g., T:curated, T:market)
        return f"T:{story_type}"

    if not tickers:
        return None

    # Normalize tickers (uppercase, remove duplicates)
    normalized_tickers = list(set([t.upper().strip() for t in tickers if t and t.strip()]))

    if not normalized_tickers:
        return None

    if len(normalized_tickers) == 1:
        # Single ticker: use tt:ticker format
        return f"tt:{normalized_tickers[0].lower()}"
    else:
        # Multiple tickers: use (or tt:ticker1 tt:ticker2 ...) format
        ticker_terms = " ".join([f"tt:{t.lower()}" for t in normalized_tickers])
        return f"(or {ticker_terms})"


def _generate_cache_key(tickers=None, story_type=None):
    """Generate a cache key from tickers or story type"""
    if story_type:
        return f"story_type:{story_type}"
    if tickers:
        normalized = sorted([t.upper().strip() for t in tickers if t and t.strip()])
        return f"tickers:{','.join(normalized)}"
    return None


# =======================
# Analytics Helper Utils
# =======================
def _safe_float(value, default=None):
    try:
        if value in (None, ''):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_datetime(value):
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            if value.endswith('Z'):
                value = value.replace('Z', '+00:00')
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def _normalize_trade_record(trade):
    symbol = (trade.get('symbol') or '').upper().strip()
    if not symbol:
        return None

    quantity = _safe_float(trade.get('quantity') or trade.get('qty') or trade.get('shares'), 0)
    if not quantity:
        return None

    entry_price = _safe_float(trade.get('entry_price') or trade.get('price'))
    if entry_price is None:
        return None

    exit_price = _safe_float(trade.get('exit_price'))
    trade_date = _parse_datetime(trade.get('trade_date') or trade.get('date') or trade.get('created_at'))
    updated_at = _parse_datetime(trade.get('updated_at'))

    direction = (trade.get('direction') or 'long').strip().lower()
    if direction not in ('long', 'short'):
        direction = 'long'

    return {
        'id': str(trade.get('_id') or trade.get('id') or ''),
        'symbol': symbol,
        'quantity': quantity,
        'entry_price': entry_price,
        'exit_price': exit_price,
        'direction': direction,
        'trade_date': trade_date,
        'updated_at': updated_at,
        'notes': trade.get('notes'),
        'strategy': trade.get('strategy'),
    }


def _evaluate_trade(trade, price_lookup):
    """Calculate current price, pnl and returns for a normalized trade record"""
    if not trade:
        return None

    direction_multiplier = -1 if trade['direction'] == 'short' else 1
    entry_value = trade['entry_price'] * trade['quantity']

    if trade['exit_price'] is not None:
        current_price = trade['exit_price']
        is_closed = True
    else:
        current_price = price_lookup.get(trade['symbol'], {}).get('current', trade['entry_price'])
        is_closed = False

    pnl = (current_price - trade['entry_price']) * trade['quantity'] * direction_multiplier
    return_pct = (pnl / entry_value * 100) if entry_value else 0
    current_value = current_price * trade['quantity']

    holding_days = None
    if trade['trade_date']:
        end_date = trade['updated_at'] if (trade['updated_at'] and is_closed) else datetime.utcnow()
        holding_days = max((end_date - trade['trade_date']).days, 0)

    return {
        **trade,
        'current_price': current_price,
        'current_value': current_value,
        'pnl': pnl,
        'return_pct': return_pct,
        'is_closed': is_closed,
        'holding_days': holding_days,
        'cost_basis': entry_value,
    }


def _calculate_equity_curve(closed_trades, unrealized_pnl):
    if not closed_trades and not unrealized_pnl:
        return []

    sorted_trades = sorted(
        closed_trades,
        key=lambda t: t['updated_at'] or t['trade_date'] or datetime.utcnow()
    )

    curve = []
    running = 0.0
    for trade in sorted_trades:
        running += trade['pnl']
        point_date = trade['updated_at'] or trade['trade_date'] or datetime.utcnow()
        curve.append({
            'date': point_date.strftime('%Y-%m-%d'),
            'value': round(running, 2)
        })

    if unrealized_pnl:
        curve.append({
            'date': 'Now',
            'value': round(running + unrealized_pnl, 2)
        })

    return curve


def _calculate_risk_metrics(equity_curve):
    if len(equity_curve) < 2:
        return {'max_drawdown': 0.0, 'volatility': 0.0, 'sharpe_ratio': 0.0}

    values = [point['value'] for point in equity_curve]
    max_value = values[0]
    max_drawdown = 0.0

    for value in values:
        if value > max_value:
            max_value = value
        drawdown = (value - max_value) / max_value if max_value else 0
        if drawdown < max_drawdown:
            max_drawdown = drawdown

    returns = []
    for i in range(1, len(values)):
        prev = values[i - 1]
        curr = values[i]
        if prev != 0:
            returns.append((curr - prev) / abs(prev))

    if returns:
        avg_return = sum(returns) / len(returns)
        variance = sum((r - avg_return) ** 2 for r in returns) / len(returns)
        volatility = math.sqrt(max(variance, 0))
        sharpe = (avg_return / volatility) if volatility else avg_return
    else:
        volatility = 0.0
        sharpe = 0.0

    return {
        'max_drawdown': round(abs(max_drawdown) * 100, 2),
        'volatility': round(volatility * 100, 2),
        'sharpe_ratio': round(sharpe * math.sqrt(len(equity_curve)) if len(equity_curve) > 1 else sharpe, 2)
    }


def _build_portfolio_analytics(trades, price_lookup):
    normalized = [_normalize_trade_record(trade) for trade in trades]
    normalized = [trade for trade in normalized if trade]

    if not normalized:
        return {
            'summary': {
                'totalCapital': 0.0,
                'realizedPnL': 0.0,
                'unrealizedPnL': 0.0,
                'totalPnL': 0.0,
                'winRate': None,
                'closedTrades': 0,
                'openPositions': 0,
                'avgReturn': 0.0,
                'exposure': {'long': 0.0, 'short': 0.0},
            },
            'charts': {
                'equityCurve': [],
                'allocation': [],
                'performanceBySymbol': [],
            },
            'insights': {
                'bestTrade': None,
                'worstTrade': None,
                'risk': {'max_drawdown': 0.0, 'volatility': 0.0, 'sharpe_ratio': 0.0},
            },
            'recentTrades': [],
            'openPositions': [],
        }

    closed_trades = []
    open_trades = []
    performance_by_symbol = defaultdict(lambda: {'pnl': 0.0, 'trades': 0})
    total_cost = 0.0
    long_exposure = 0.0
    short_exposure = 0.0
    wins = 0
    losses = 0

    for trade in normalized:
        metrics = _evaluate_trade(trade, price_lookup)
        if not metrics:
            continue

        total_cost += metrics['cost_basis']
        performance_by_symbol[metrics['symbol']]['pnl'] += metrics['pnl']
        performance_by_symbol[metrics['symbol']]['trades'] += 1

        exposure_value = abs(metrics['current_price'] * metrics['quantity'])
        if metrics['direction'] == 'short':
            short_exposure += exposure_value
        else:
            long_exposure += exposure_value

        if metrics['is_closed']:
            closed_trades.append(metrics)
            if metrics['pnl'] > 0:
                wins += 1
            elif metrics['pnl'] < 0:
                losses += 1
        else:
            open_trades.append(metrics)

    realized_pnl = sum(t['pnl'] for t in closed_trades)
    unrealized_pnl = sum(t['pnl'] for t in open_trades)
    equity_curve = _calculate_equity_curve(closed_trades, unrealized_pnl)
    risk_metrics = _calculate_risk_metrics(equity_curve)

    allocation_total = sum(abs(t['current_price'] * t['quantity']) for t in open_trades)
    allocation = []
    if allocation_total:
        for trade in sorted(open_trades, key=lambda t: abs(t['current_price'] * t['quantity']), reverse=True):
            value = abs(trade['current_price'] * trade['quantity'])
            allocation.append({
                'symbol': trade['symbol'],
                'value': round(value, 2),
                'percent': round((value / allocation_total) * 100, 2)
            })

    performance_chart = [
        {
            'symbol': symbol,
            'pnl': round(data['pnl'], 2),
            'trades': data['trades']
        }
        for symbol, data in sorted(
            performance_by_symbol.items(),
            key=lambda item: abs(item[1]['pnl']),
            reverse=True
        )
    ][:8]

    all_trades = closed_trades + open_trades
    best_trade = max(all_trades, key=lambda t: t['pnl'], default=None)
    worst_trade = min(all_trades, key=lambda t: t['pnl'], default=None)

    def _serialize_trade(trade_snapshot):
        if not trade_snapshot:
            return None
        return {
            'symbol': trade_snapshot['symbol'],
            'pnl': round(trade_snapshot['pnl'], 2),
            'return_pct': round(trade_snapshot['return_pct'], 2),
            'quantity': trade_snapshot['quantity'],
            'direction': trade_snapshot['direction'],
            'entry_price': trade_snapshot['entry_price'],
            'exit_price': trade_snapshot.get('exit_price'),
            'current_price': trade_snapshot['current_price'],
            'is_closed': trade_snapshot['is_closed'],
            'holding_days': trade_snapshot['holding_days'],
            'trade_date': trade_snapshot['trade_date'].isoformat() if trade_snapshot['trade_date'] else None,
            'updated_at': trade_snapshot['updated_at'].isoformat() if trade_snapshot['updated_at'] else None,
        }

    recent_trades = sorted(
        normalized,
        key=lambda t: t['trade_date'] or t['updated_at'] or datetime.utcnow(),
        reverse=True
    )[:6]

    recent_trades_payload = []
    for trade in recent_trades:
        metrics = _evaluate_trade(trade, price_lookup)
        if not metrics:
            continue
        recent_trades_payload.append({
            'symbol': metrics['symbol'],
            'direction': metrics['direction'],
            'trade_date': metrics['trade_date'].isoformat() if metrics['trade_date'] else None,
            'is_closed': metrics['is_closed'],
            'pnl': round(metrics['pnl'], 2),
            'return_pct': round(metrics['return_pct'], 2),
            'quantity': metrics['quantity'],
            'entry_price': metrics['entry_price'],
            'exit_price': metrics.get('exit_price'),
            'current_price': metrics['current_price'],
        })

    open_positions_payload = [
        {
            'symbol': trade['symbol'],
            'direction': trade['direction'],
            'quantity': trade['quantity'],
            'entry_price': trade['entry_price'],
            'current_price': trade['current_price'],
            'current_value': round(trade['current_value'], 2),
            'pnl': round(trade['pnl'], 2),
            'return_pct': round(trade['return_pct'], 2),
            'notes': trade['notes'],
        }
        for trade in open_trades
    ]

    summary = {
        'totalCapital': round(total_cost, 2),
        'realizedPnL': round(realized_pnl, 2),
        'unrealizedPnL': round(unrealized_pnl, 2),
        'totalPnL': round(realized_pnl + unrealized_pnl, 2),
        'winRate': round((wins / len(closed_trades)) * 100, 2) if closed_trades else None,
        'closedTrades': len(closed_trades),
        'openPositions': len(open_trades),
        'avgReturn': round(
            sum(t['return_pct'] for t in closed_trades) / len(closed_trades), 2
        ) if closed_trades else 0.0,
        'exposure': {
            'long': round(long_exposure, 2),
            'short': round(short_exposure, 2),
        }
    }

    return {
        'summary': summary,
        'charts': {
            'equityCurve': equity_curve,
            'allocation': allocation,
            'performanceBySymbol': performance_chart,
        },
        'insights': {
            'bestTrade': _serialize_trade(best_trade),
            'worstTrade': _serialize_trade(worst_trade),
            'risk': risk_metrics,
            'winLoss': {
                'wins': wins,
                'losses': losses,
            }
        },
        'recentTrades': recent_trades_payload,
        'openPositions': open_positions_payload,
    }


@app.route('/api/analytics/portfolio', methods=['GET'])
@login_required
def get_portfolio_analytics():
    """Compute advanced portfolio analytics for the authenticated user"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401

        user_id = user_info['user_id']
        trades = mongodb_manager.get_user_trades(user_id) or []

        open_symbols = {
            (trade.get('symbol') or '').upper().strip()
            for trade in trades
            if not trade.get('exit_price') and trade.get('symbol')
        }

        price_lookup = {}
        if open_symbols:
            try:
                price_lookup = fetch_symbol_quotes(list(open_symbols))
            except Exception as e:
                print(f"[analytics] Error fetching prices: {e}")
                price_lookup = {}

        analytics = _build_portfolio_analytics(trades, price_lookup)
        return jsonify({'success': True, 'data': analytics})

    except Exception as e:
        print(f"Error generating portfolio analytics: {e}")
        return jsonify({'success': False, 'error': 'Failed to compute analytics'}), 500


# Price Alerts API Endpoints
@app.route('/api/alerts', methods=['GET'])
@login_required
def get_alerts():
    """Get all alerts for the current user"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        active_only = request.args.get('active_only', 'false').lower() == 'true'
        alerts = mongodb_manager.get_user_alerts(user_info['user_id'], active_only=active_only)
        
        return jsonify({
            'success': True,
            'alerts': alerts
        })
    except Exception as e:
        print(f"Error getting alerts: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/alerts', methods=['POST'])
@login_required
def create_alert():
    """Create a new price alert"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        data = request.get_json()
        
        # Validate required fields
        if not data.get('symbol'):
            return jsonify({'success': False, 'error': 'Symbol is required'}), 400

        notification_method = data.get('notification_method', 'in_app')
        if notification_method not in ALERT_NOTIFICATION_METHODS:
            return jsonify({'success': False, 'error': 'Invalid notification method'}), 400
        data['notification_method'] = notification_method
        
        alert_id = mongodb_manager.save_price_alert(user_info['user_id'], data)
        
        if alert_id:
            return jsonify({
                'success': True,
                'alert_id': alert_id,
                'message': 'Alert created successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to create alert'}), 500
            
    except Exception as e:
        print(f"Error creating alert: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/alerts/<alert_id>', methods=['GET'])
@login_required
def get_alert(alert_id):
    """Get a specific alert by ID"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        alert = mongodb_manager.get_alert(user_info['user_id'], alert_id)
        
        if alert:
            return jsonify({
                'success': True,
                'alert': alert
            })
        else:
            return jsonify({'success': False, 'error': 'Alert not found'}), 404
            
    except Exception as e:
        print(f"Error getting alert: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/alerts/<alert_id>', methods=['PUT'])
@login_required
def update_alert(alert_id):
    """Update an existing alert"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        data = request.get_json()

        if 'notification_method' in data:
            if data['notification_method'] not in ALERT_NOTIFICATION_METHODS:
                return jsonify({'success': False, 'error': 'Invalid notification method'}), 400
        
        success = mongodb_manager.update_price_alert(user_info['user_id'], alert_id, data)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Alert updated successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Alert not found or update failed'}), 404
            
    except Exception as e:
        print(f"Error updating alert: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/alerts/<alert_id>', methods=['DELETE'])
@login_required
def delete_alert(alert_id):
    """Delete an alert"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        success = mongodb_manager.delete_price_alert(user_info['user_id'], alert_id)
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Alert deleted successfully'
            })
        else:
            return jsonify({'success': False, 'error': 'Alert not found'}), 404
            
    except Exception as e:
        print(f"Error deleting alert: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/alerts/notifications', methods=['GET'])
@login_required
def get_alert_notifications():
    """Get alert notifications for the current user"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        if mongodb_manager.client is None:
            return jsonify({'success': True, 'notifications': []})
        
        notifications_collection = mongodb_manager.db.alert_notifications
        notifications = list(notifications_collection.find({
            'user_id': user_info['user_id']
        }).sort('created_at', -1).limit(50))
        
        # Convert ObjectId to string and datetime to ISO
        for notif in notifications:
            notif['_id'] = str(notif['_id'])
            if notif.get('created_at'):
                notif['created_at'] = notif['created_at'].isoformat()
        
        return jsonify({
            'success': True,
            'notifications': notifications
        })
    except Exception as e:
        print(f"Error getting notifications: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/alerts/notifications/<notification_id>/read', methods=['PUT'])
@login_required
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        if mongodb_manager.client is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
        
        notifications_collection = mongodb_manager.db.alert_notifications
        result = notifications_collection.update_one(
            {'_id': ObjectId(notification_id), 'user_id': user_info['user_id']},
            {'$set': {'read': True}}
        )
        
        if result.modified_count > 0:
            return jsonify({'success': True, 'message': 'Notification marked as read'})
        else:
            return jsonify({'success': False, 'error': 'Notification not found'}), 404
            
    except Exception as e:
        print(f"Error marking notification as read: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/alerts/notifications/read-all', methods=['PUT'])
@login_required
def mark_all_notifications_read():
    """Mark all notifications as read for the current user"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        
        if mongodb_manager.client is None:
            return jsonify({'success': False, 'error': 'Database not available'}), 500
        
        notifications_collection = mongodb_manager.db.alert_notifications
        result = notifications_collection.update_many(
            {'user_id': user_info['user_id'], 'read': False},
            {'$set': {'read': True}}
        )
        
        return jsonify({
            'success': True,
            'message': f'{result.modified_count} notifications marked as read'
        })
            
    except Exception as e:
        print(f"Error marking all notifications as read: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/news/unified', methods=['POST'])
@login_required
def get_unified_news():
    """Fetch ALL news data in one unified request: all tickers + all story types"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        user_id = user_info['user_id']

        data = request.get_json() or {}
        use_cache = data.get('use_cache', True)

        # Check cache FIRST (before rate limits)
        if use_cache:
            cached_data = mongodb_manager.get_unified_news_cache(user_id)
            if cached_data:
                return jsonify({
                    'success': True,
                    'data': cached_data,
                    'cached': True
                })

        # Only check rate limits if we need to make API calls
        # Check user rate limit
        can_fetch, wait_time = _check_user_news_rate_limit(user_id)
        if not can_fetch:
            return jsonify({
                'success': False,
                'error': f'Please wait {wait_time} seconds before refreshing news.',
                'rate_limited': True,
                'wait_time': wait_time
            }), 429

        # Check IP rate limit
        can_request, ip_wait_time = _check_tickertick_rate_limit()
        if not can_request:
            return jsonify({
                'success': False,
                'error': f'Rate limit exceeded. Please wait {int(ip_wait_time)} seconds.',
                'rate_limited': True,
                'wait_time': int(ip_wait_time)
            }), 429

        # Get all tickers from watchlist and journal
        watchlist_items = mongodb_manager.get_user_watchlist(user_id)
        trades = mongodb_manager.get_user_trades(user_id)

        # Collect all unique tickers
        all_tickers = set()
        for item in watchlist_items:
            if item.get('symbol'):
                all_tickers.add(item['symbol'].upper().strip())
        for trade in trades:
            if trade.get('symbol'):
                all_tickers.add(trade['symbol'].upper().strip())

        normalized_tickers = sorted(list(all_tickers))

        # All story types
        all_story_types = ['curated', 'market', 'sec_fin', 'trade', 'analysis']

        # Fetch ticker news
        ticker_data = {}
        if normalized_tickers:
            query = _build_tickertick_query(normalized_tickers, None)
            if query:
                api_url = 'https://api.tickertick.com/feed'
                params = {'q': query, 'n': 50}

                response = requests.get(api_url, params=params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    stories = data.get('stories', [])

                    formatted_stories = []
                    ticker_stories_map = {ticker: [] for ticker in normalized_tickers}

                    for story in stories:
                        story_tickers = story.get('tickers', story.get('tags', []))
                        formatted_story = {
                            'id': story.get('id'),
                            'title': story.get('title', ''),
                            'url': story.get('url', ''),
                            'site': story.get('site', ''),
                            'time': story.get('time'),
                            'favicon_url': story.get('favicon_url', ''),
                            'description': story.get('description', ''),
                            'tickers': story_tickers
                        }

                        formatted_stories.append(formatted_story)

                        for ticker in story_tickers:
                            ticker_upper = ticker.upper()
                            if ticker_upper in ticker_stories_map:
                                ticker_stories_map[ticker_upper].append(formatted_story)

                    # NO sentiment analysis here - cache first, then apply sentiment on retrieval
                    formatted_stories.sort(key=lambda x: x.get('time', 0), reverse=True)

                    # Sort and limit stories per ticker
                    for ticker in ticker_stories_map:
                        ticker_stories_map[ticker].sort(key=lambda x: x.get('time', 0), reverse=True)
                        ticker_stories_map[ticker] = ticker_stories_map[ticker][:30]

                    ticker_data = {
                        'all_stories': formatted_stories[:50],
                        'by_ticker': ticker_stories_map,
                        'tickers': normalized_tickers
                    }

        # Fetch story type news
        story_type_data = {}
        for story_type in all_story_types:
            query = _build_tickertick_query(None, story_type)
            if query:
                api_url = 'https://api.tickertick.com/feed'
                params = {'q': query, 'n': 30}

                response = requests.get(api_url, params=params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    stories = data.get('stories', [])

                    formatted_stories = []
                    for story in stories:
                        formatted_stories.append({
                            'id': story.get('id'),
                            'title': story.get('title', ''),
                            'url': story.get('url', ''),
                            'site': story.get('site', ''),
                            'time': story.get('time'),
                            'favicon_url': story.get('favicon_url', ''),
                            'description': story.get('description', ''),
                            'tickers': story.get('tickers', story.get('tags', []))
                        })

                    # NO sentiment analysis here - cache first, then apply sentiment on retrieval
                    formatted_stories.sort(key=lambda x: x.get('time', 0), reverse=True)
                    story_type_data[story_type] = formatted_stories[:30]

        # Combine all data
        unified_data = {
            'tickers': ticker_data,
            'storyTypes': story_type_data,
            'metadata': {
                'cachedTickers': normalized_tickers,
                'cachedStoryTypes': all_story_types,
                'lastFetch': datetime.utcnow().isoformat()
            }
        }

        # Cache the unified data (without sentiment - will be applied on retrieval)
        mongodb_manager.set_unified_news_cache(
            user_id,
            unified_data,
            {
                'tickers': normalized_tickers,
                'story_types': all_story_types,
                'ticker_count': len(normalized_tickers),
                'story_type_count': len(all_story_types)
            }
        )

        return jsonify({
            'success': True,
            'data': unified_data,
            'cached': False
        })

    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'Request to TickerTick API timed out'
        }), 504
    except requests.exceptions.RequestException as e:
        print(f"[news unified] Request error: {e}")
        return jsonify({
            'success': False,
            'error': f'Error fetching news: {str(e)}'
        }), 500
    except Exception as e:
        print(f"[news unified] Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/news/batch', methods=['POST'])
@login_required
def get_news_batch():
    """Fetch news in batches: all tickers (watchlist+journal) and all story types"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        user_id = user_info['user_id']

        data = request.get_json() or {}
        request_type = data.get('type')  # 'tickers' or 'story_types'
        tickers = data.get('tickers', [])
        story_types = data.get('story_types', [])
        n = data.get('n', 50)
        use_cache = data.get('use_cache', True)

        # Limit n to 200
        n = min(max(1, n), 200)

        result = {}

        if request_type == 'tickers' and tickers:
            # Handle batch ticker request
            normalized_tickers = list(set([t.upper().strip() for t in tickers if t and t.strip()]))

            if normalized_tickers:
                # Check if all requested tickers are already in cache (BEFORE rate limit check)
                if use_cache:
                    all_in_cache, cached_batch = mongodb_manager.check_tickers_in_cache(user_id, normalized_tickers)
                    if all_in_cache and cached_batch:
                        return jsonify({
                            'success': True,
                            'data': cached_batch,
                            'cached': True
                        })
                    elif cached_batch:
                        # Partial cache - we have some data but not all requested tickers
                        pass

                # Only check rate limits if we need to make an API call
                # Check user rate limit
                can_fetch, wait_time = _check_user_news_rate_limit(user_id)
                if not can_fetch:
                    return jsonify({
                        'success': False,
                        'error': f'Please wait {wait_time} seconds before refreshing news.',
                        'rate_limited': True,
                        'wait_time': wait_time
                    }), 429

                # Check IP rate limit
                can_request, ip_wait_time = _check_tickertick_rate_limit()
                if not can_request:
                    return jsonify({
                        'success': False,
                        'error': f'Rate limit exceeded. Please wait {int(ip_wait_time)} seconds.',
                        'rate_limited': True,
                        'wait_time': int(ip_wait_time)
                    }), 429

                # Fetch from API
                query = _build_tickertick_query(normalized_tickers, None)
                api_url = 'https://api.tickertick.com/feed'
                params = {'q': query, 'n': n * 2}  # Fetch more to account for filtering

                response = requests.get(api_url, params=params, timeout=10)

                if response.status_code != 200:
                    print(f"[news batch] TickerTick API error: {response.status_code}")
                    return jsonify({
                        'success': False,
                        'error': f'TickerTick API error: {response.status_code}'
                    }), response.status_code

                data = response.json()
                stories = data.get('stories', [])

                # Format and organize stories by ticker
                formatted_stories = []
                ticker_stories_map = {ticker: [] for ticker in normalized_tickers}

                for story in stories:
                    story_tickers = story.get('tickers', story.get('tags', []))
                    formatted_story = {
                        'id': story.get('id'),
                        'title': story.get('title', ''),
                        'url': story.get('url', ''),
                        'site': story.get('site', ''),
                        'time': story.get('time'),
                        'favicon_url': story.get('favicon_url', ''),
                        'description': story.get('description', ''),
                        'tickers': story_tickers
                    }

                    formatted_stories.append(formatted_story)

                    # Add to ticker-specific maps
                    for ticker in story_tickers:
                        ticker_upper = ticker.upper()
                        if ticker_upper in ticker_stories_map:
                            ticker_stories_map[ticker_upper].append(formatted_story)
                # Sort all stories by time
                formatted_stories.sort(key=lambda x: x.get('time', 0), reverse=True)

                # Merge with existing cache if we have partial cache
                existing_cache = None
                if use_cache:
                    _, existing_cache = mongodb_manager.check_tickers_in_cache(user_id, normalized_tickers)

                if existing_cache and isinstance(existing_cache, dict):
                    # Merge with existing cache
                    existing_tickers = set(existing_cache.get('tickers', []))
                    existing_by_ticker = existing_cache.get('by_ticker', {})
                    existing_all_stories = existing_cache.get('all_stories', [])

                    # Add new tickers to the set
                    all_tickers = existing_tickers.union(set(normalized_tickers))

                    # Merge by_ticker maps
                    merged_by_ticker = existing_by_ticker.copy()
                    for ticker, stories_list in ticker_stories_map.items():
                        if ticker in merged_by_ticker:
                            # Merge stories, remove duplicates by id
                            existing_ids = {s.get('id') for s in merged_by_ticker[ticker]}
                            new_stories = [s for s in stories_list if s.get('id') not in existing_ids]
                            merged_by_ticker[ticker].extend(new_stories)
                            merged_by_ticker[ticker].sort(key=lambda x: x.get('time', 0), reverse=True)
                            merged_by_ticker[ticker] = merged_by_ticker[ticker][:n]
                        else:
                            merged_by_ticker[ticker] = stories_list[:n]

                    # Merge all_stories, remove duplicates
                    existing_story_ids = {s.get('id') for s in existing_all_stories}
                    new_stories = [s for s in formatted_stories if s.get('id') not in existing_story_ids]
                    merged_all_stories = existing_all_stories + new_stories
                    merged_all_stories.sort(key=lambda x: x.get('time', 0), reverse=True)

                    batch_data = {
                        'all_stories': merged_all_stories[:n * 2],  # Keep more stories for filtering
                        'by_ticker': merged_by_ticker,
                        'tickers': list(all_tickers)
                    }
                else:
                    # No existing cache, use new data
                    batch_data = {
                        'all_stories': formatted_stories[:n],
                        'by_ticker': {ticker: stories[:n] for ticker, stories in ticker_stories_map.items()},
                        'tickers': normalized_tickers
                    }

                mongodb_manager.set_news_cache_batch(
                    user_id,
                    'tickers',
                    batch_data,
                    {'tickers': list(batch_data.get('tickers', [])), 'count': len(batch_data.get('all_stories', []))}
                )

                return jsonify({
                    'success': True,
                    'data': batch_data,
                    'cached': False
                })

        elif request_type == 'story_types' and story_types:
            # Handle batch story type request
            result_by_type = {}

            # Check if all requested story types are already in cache (BEFORE rate limit check)
            if use_cache:
                all_in_cache, cached_batch = mongodb_manager.check_story_types_in_cache(user_id, story_types)
                if all_in_cache and cached_batch:
                    return jsonify({
                        'success': True,
                        'data': cached_batch,
                        'cached': True
                    })
                elif cached_batch:
                    # Partial cache - we have some data but not all requested story types
                    pass

            # Only check rate limits if we need to make an API call
            # Check user rate limit
            can_fetch, wait_time = _check_user_news_rate_limit(user_id)
            if not can_fetch:
                return jsonify({
                    'success': False,
                    'error': f'Please wait {wait_time} seconds before refreshing news.',
                    'rate_limited': True,
                    'wait_time': wait_time
                }), 429

            # Check IP rate limit
            can_request, ip_wait_time = _check_tickertick_rate_limit()
            if not can_request:
                return jsonify({
                    'success': False,
                    'error': f'Rate limit exceeded. Please wait {int(ip_wait_time)} seconds.',
                    'rate_limited': True,
                    'wait_time': int(ip_wait_time)
                }), 429

            # Fetch all story types
            all_stories_by_type = {}
            for story_type in story_types:
                query = _build_tickertick_query(None, story_type)
                api_url = 'https://api.tickertick.com/feed'
                params = {'q': query, 'n': n}

                response = requests.get(api_url, params=params, timeout=10)

                if response.status_code == 200:
                    data = response.json()
                    stories = data.get('stories', [])

                    formatted_stories = []
                    for story in stories:
                        formatted_stories.append({
                            'id': story.get('id'),
                            'title': story.get('title', ''),
                            'url': story.get('url', ''),
                            'site': story.get('site', ''),
                            'time': story.get('time'),
                            'favicon_url': story.get('favicon_url', ''),
                            'description': story.get('description', ''),
                            'tickers': story.get('tickers', story.get('tags', []))
                        })

                    # NO sentiment analysis here - cache first, then apply sentiment on retrieval
                    formatted_stories.sort(key=lambda x: x.get('time', 0), reverse=True)
                    all_stories_by_type[story_type] = formatted_stories[:n]
                else:
                    print(f"[news batch] Error fetching {story_type}: {response.status_code}")
                    all_stories_by_type[story_type] = []

            # Cache the batch data (without sentiment - will be applied on retrieval)
            mongodb_manager.set_news_cache_batch(
                user_id,
                'story_types',
                all_stories_by_type,
                {'story_types': story_types, 'count': sum(len(stories) for stories in all_stories_by_type.values())}
            )

            return jsonify({
                'success': True,
                'data': all_stories_by_type,
                'cached': False
            })

        return jsonify({
            'success': False,
            'error': 'Invalid request type or missing parameters'
        }), 400

    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'Request to TickerTick API timed out'
        }), 504
    except requests.exceptions.RequestException as e:
        print(f"[news batch] Request error: {e}")
        return jsonify({
            'success': False,
            'error': f'Error fetching news: {str(e)}'
        }), 500
    except Exception as e:
        print(f"[news batch] Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/news', methods=['GET', 'POST'])
@login_required
def get_news():
    """Fetch news stories for given tickers or story type using TickerTick API"""
    try:
        user_info = get_user_info()
        if not user_info:
            return jsonify({'success': False, 'error': 'Authentication required'}), 401
        user_id = user_info['user_id']

        # Check user rate limit (once per minute per user)
        can_fetch, wait_time = _check_user_news_rate_limit(user_id)
        if not can_fetch:
            return jsonify({
                'success': False,
                'error': f'Please wait {wait_time} seconds before refreshing news.',
                'rate_limited': True,
                'wait_time': wait_time
            }), 429

        # Check IP rate limit (10 requests per minute per IP)
        can_request, ip_wait_time = _check_tickertick_rate_limit()
        if not can_request:
            return jsonify({
                'success': False,
                'error': f'Rate limit exceeded. Please wait {int(ip_wait_time)} seconds.',
                'rate_limited': True,
                'wait_time': int(ip_wait_time)
            }), 429

        # Get parameters from request
        if request.method == 'POST':
            data = request.get_json() or {}
            tickers = data.get('tickers', [])
            story_type = data.get('story_type')
            n = data.get('n', 50)  # Number of stories to fetch
            use_cache = data.get('use_cache', True)  # Default to using cache
        else:
            tickers_str = request.args.get('tickers', '')
            tickers = [t.strip() for t in tickers_str.split(',') if t.strip()] if tickers_str else []
            story_type = request.args.get('story_type')
            n = int(request.args.get('n', 50))
            use_cache = request.args.get('use_cache', 'true').lower() == 'true'

        # Validate input
        if not tickers and not story_type:
            return jsonify({
                'success': False,
                'error': 'Either tickers or story_type must be provided'
            }), 400

        # Limit n to 200 (API max)
        n = min(max(1, n), 200)

        # Handle story type queries (use user-based cache)
        if story_type:
            cache_key = _generate_cache_key(None, story_type)

            # Check cache if enabled
            if use_cache and cache_key:
                cached_stories = mongodb_manager.get_news_cache(user_id, cache_key)
                if cached_stories is not None:
                    return jsonify({
                        'success': True,
                        'stories': cached_stories,
                        'count': len(cached_stories),
                        'cached': True,
                        'query': _build_tickertick_query(None, story_type)
                    })

            # Fetch from API for story type
            query = _build_tickertick_query(None, story_type)
            api_url = 'https://api.tickertick.com/feed'
            params = {'q': query, 'n': n}

            response = requests.get(api_url, params=params, timeout=10)

            if response.status_code != 200:
                print(f"[news] TickerTick API error: {response.status_code} - {response.text}")
                return jsonify({
                    'success': False,
                    'error': f'TickerTick API error: {response.status_code}'
                }), response.status_code

            data = response.json()
            stories = data.get('stories', [])

            # Format stories
            formatted_stories = []
            for story in stories:
                formatted_stories.append({
                    'id': story.get('id'),
                    'title': story.get('title', ''),
                    'url': story.get('url', ''),
                    'site': story.get('site', ''),
                    'time': story.get('time'),
                    'favicon_url': story.get('favicon_url', ''),
                    'description': story.get('description', ''),
                    'tickers': story.get('tickers', story.get('tags', []))
                })

            # Cache the results
            if cache_key:
                mongodb_manager.set_news_cache(user_id, cache_key, formatted_stories)

            return jsonify({
                'success': True,
                'stories': formatted_stories,
                'count': len(formatted_stories),
                'cached': False,
                'query': query
            })

        # Handle ticker-based queries (use per-symbol cache)
        if not tickers:
            return jsonify({
                'success': False,
                'error': 'No tickers provided'
            }), 400

        # Normalize tickers
        normalized_tickers = list(set([t.upper().strip() for t in tickers if t and t.strip()]))

        if not normalized_tickers:
            return jsonify({
                'success': False,
                'error': 'Invalid tickers provided'
            }), 400

        # Check per-symbol cache first
        cached_by_symbol = {}
        symbols_to_fetch = []

        if use_cache:
            cached_by_symbol = mongodb_manager.get_multiple_symbols_news_cache(normalized_tickers)
            symbols_to_fetch = [s for s in normalized_tickers if s not in cached_by_symbol]
        else:
            symbols_to_fetch = normalized_tickers

        # Collect cached stories
        all_stories = []
        story_ids_seen = set()

        for symbol, cached_stories in cached_by_symbol.items():
            for story in cached_stories:
                story_id = story.get('id') or str(story.get('url', ''))
                if story_id and story_id not in story_ids_seen:
                    all_stories.append(story)
                    story_ids_seen.add(story_id)

        # Fetch news for symbols not in cache
        if symbols_to_fetch:
            # Build query for symbols to fetch
            query = _build_tickertick_query(symbols_to_fetch, None)
            if not query:
                return jsonify({
                    'success': False,
                    'error': 'Invalid query parameters'
                }), 400

            # Fetch from API
            api_url = 'https://api.tickertick.com/feed'
            params = {
                'q': query,
                'n': n * 2  # Fetch more to account for filtering
            }

            response = requests.get(api_url, params=params, timeout=10)

            if response.status_code != 200:
                print(f"[news] TickerTick API error: {response.status_code} - {response.text}")
                # If API fails but we have cached data, return cached data
                if all_stories:
                    return jsonify({
                        'success': True,
                        'stories': all_stories[:n],
                        'count': len(all_stories),
                        'cached': True,
                        'partial': True,
                        'query': query
                    })
                return jsonify({
                    'success': False,
                    'error': f'TickerTick API error: {response.status_code}'
                }), response.status_code

            data = response.json()
            fetched_stories = data.get('stories', [])

            # Format and cache stories per symbol
            symbol_stories_map = {symbol: [] for symbol in symbols_to_fetch}
            temp_formatted_stories = []

            for story in fetched_stories:
                story_tickers = story.get('tickers', story.get('tags', []))
                formatted_story = {
                    'id': story.get('id'),
                    'title': story.get('title', ''),
                    'url': story.get('url', ''),
                    'site': story.get('site', ''),
                    'time': story.get('time'),
                    'favicon_url': story.get('favicon_url', ''),
                    'description': story.get('description', ''),
                    'tickers': story_tickers
                }
                temp_formatted_stories.append(formatted_story)

                # Add story to each matching symbol's cache
                for ticker in story_tickers:
                    ticker_upper = ticker.upper()
                    if ticker_upper in symbol_stories_map:
                        symbol_stories_map[ticker_upper].append(formatted_story)

                # Add to all stories if not duplicate
                story_id = formatted_story.get('id') or str(formatted_story.get('url', ''))
                if story_id and story_id not in story_ids_seen:
                    all_stories.append(formatted_story)
                    story_ids_seen.add(story_id)

            # NO sentiment analysis here - cache first, then apply sentiment on retrieval
            # Cache stories per symbol
            for symbol, stories_list in symbol_stories_map.items():
                if stories_list:
                    mongodb_manager.set_symbol_news_cache(symbol, stories_list)

        # Sort stories by time (newest first) and limit
        all_stories.sort(key=lambda x: x.get('time', 0), reverse=True)
        final_stories = all_stories[:n]

        return jsonify({
            'success': True,
            'stories': final_stories,
            'count': len(final_stories),
            'cached': len(symbols_to_fetch) == 0,  # Fully cached if no API calls
            'query': _build_tickertick_query(normalized_tickers, None)
        })

    except requests.exceptions.Timeout:
        return jsonify({
            'success': False,
            'error': 'Request to TickerTick API timed out'
        }), 504
    except requests.exceptions.RequestException as e:
        print(f"[news] Request error: {e}")
        return jsonify({
            'success': False,
            'error': f'Error fetching news: {str(e)}'
        }), 500
    except Exception as e:
        print(f"[news] Error: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/fields', methods=['GET'])
def get_fields_metadata():
    """Get field metadata for the dynamic filter builder"""
    try:

        # Check if file exists
        import os
        if not os.path.exists('static/fields.json'):
            raise FileNotFoundError("fields.json file not found in static directory")

        with open('static/fields.json', 'r', encoding='utf-8') as f:
            fields_data = json.load(f)

        # Validate the data structure
        if 'fields' not in fields_data:
            raise ValueError("Invalid fields.json: missing 'fields' key")
        if 'groups' not in fields_data:
            raise ValueError("Invalid fields.json: missing 'groups' key")
        if 'grouped_fields' not in fields_data:
            raise ValueError("Invalid fields.json: missing 'grouped_fields' key")

        return jsonify({
            'success': True,
            'data': fields_data
        })
    except FileNotFoundError as e:
        error_msg = f'Field metadata file not found: {str(e)}'
        print(f"❌ {error_msg}")
        return jsonify({
            'success': False,
            'error': error_msg
        }), 404
    except json.JSONDecodeError as e:
        error_msg = f'Invalid JSON in fields.json: {str(e)}'
        print(f"❌ {error_msg}")
        return jsonify({
            'success': False,
            'error': error_msg
        }), 500
    except Exception as e:
        error_msg = f'Error loading field metadata: {str(e)}'
        print(f"❌ {error_msg}")
        return jsonify({
            'success': False,
            'error': error_msg
        }), 500


@app.route('/api/screener', methods=['POST'])
def dynamic_screener():
    """Dynamic screener API with flexible filter builder"""
    try:
        data = request.get_json()

        # Validate request using Pydantic
        try:
            screener_request = ScreenerRequest(**data)
        except ValidationError as e:
            return jsonify({
                'success': False,
                'message': 'Invalid request format',
                'errors': e.errors()
            }), 400
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'Unexpected validation error: {str(e)}'
            }), 500

        # Get filter serializer
        serializer = get_filter_serializer()

        # Use dynamic TradingView Query serialization
        try:
            query = serializer.serialize_screener_request(screener_request)

            # Execute the query
            columns, results_df = query.get_scanner_data()

        except Exception as query_error:
            return jsonify({
                'success': False,
                'message': f'Error processing dynamic screener request: {str(query_error)}',
                'count': 0
            }), 500

        if results_df.empty:
            return jsonify({
                'success': False,
                'message': 'No symbols found matching the criteria.',
                'count': 0
            })

        # Apply custom column selection if specified
        if screener_request.columns:
            available_columns = [col for col in screener_request.columns if col in results_df.columns]
            if available_columns:
                display_df = results_df[available_columns]
            else:
                display_df = results_df
        else:
            display_df = results_df

        # Apply custom sorting if specified
        if screener_request.sort_by and screener_request.sort_by in display_df.columns:
            display_df = display_df.sort_values(
                screener_request.sort_by,
                ascending=screener_request.sort_ascending
            )

        # Apply limit
        if screener_request.limit and screener_request.limit > 0:
            display_df = display_df.head(screener_request.limit)

        # Create TradingView links (reuse existing logic)
        def create_tradingview_link(row):
            symbol = row['name']
            exchange = row['exchange']

            exchange_mapping = {
                'NASDAQ': 'NASDAQ', 'NYSE': 'NYSE', 'NYSE AMERICAN': 'NYSEAMERICAN',
                'NYSE ARCA': 'NYSEARCA', 'CBOE': 'CBOE', 'CBOE BZX': 'CBOEBZX',
                'CBOE BYX': 'CBOEBYX', 'CBOE EDGX': 'CBOEEDGX', 'CBOE EDGA': 'CBOEEDGA',
                'IEX': 'IEX', 'OTC': 'OTC', 'OTC MARKETS': 'OTCMARKETS'
            }

            tv_exchange = exchange_mapping.get(exchange, exchange)
            symbol_pair = f"{tv_exchange}-{symbol}"
            encoded_symbol = urllib.parse.quote(symbol_pair)

            return f"https://www.tradingview.com/symbols/{encoded_symbol}/?utm_source=androidapp&utm_medium=share"

        # Add TradingView links
        display_df['tradingview_link'] = display_df.apply(create_tradingview_link, axis=1)

        # Create CSV export (without tradingview_link column)
        csv_export_df = display_df.drop(columns=['tradingview_link'])
        csv_buffer = io.StringIO()
        csv_export_df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)

        # Prepare response data (replace NaN with None)
        all_data_df = display_df.replace({pd.NA: None, float('nan'): None, math.nan: None})
        all_data = all_data_df.to_dict(orient='records')
        display_columns = [col for col in display_df.columns if col != 'tradingview_link']

        response_data = ScreenerResponse(
            success=True,
            count=len(display_df),
            data=all_data,
            columns=display_columns,
            message=f'Found {len(display_df)} symbols using dynamic filters!',
            csv_data=csv_buffer.getvalue(),
            filename=f"dynamic_screener_results_{datetime.today().strftime('%Y%m%d')}.csv"
        )

        return jsonify(response_data.dict())

    except Exception as e:
        print(f"❌ Error in dynamic screener: {e}")
        return jsonify({
            'success': False,
            'message': f'Error processing dynamic screener request: {str(e)}',
            'count': 0
        }), 500


@app.route('/api/query', methods=['POST'])
def api_query():
    try:
        data = request.get_json()

        # Extract parameters from request
        us_exchanges_only = data.get('us_exchanges_only', True)
        min_price = data.get('min_price')
        min_relative_volume = data.get('min_relative_volume')
        min_change = data.get('min_change')
        max_change = data.get('max_change')
        min_sma20_above_pct = data.get('min_sma20_above_pct')
        min_atr_pct = data.get('min_atr_pct')
        min_adr_pct = data.get('min_adr_pct')
        min_rsi = data.get('min_rsi')
        max_rsi = data.get('max_rsi')
        min_bb_percent_b = data.get('min_bb_percent_b')
        max_bb_percent_b = data.get('max_bb_percent_b')
        filter_out_otc = data.get('filter_out_otc', True)
        bullish_candlestick_patterns_only = data.get('bullish_candlestick_patterns_only', False)

        # Call the existing query function
        results = query_by_params(
            us_exchanges_only=us_exchanges_only,
            min_price=min_price,
            min_relative_volume=min_relative_volume,
            min_change=min_change,
            max_change=max_change,
            min_sma20_above_pct=min_sma20_above_pct,
            min_atr_pct=min_atr_pct,
            min_adr_pct=min_adr_pct,
            min_rsi=min_rsi,
            max_rsi=max_rsi,
            min_bb_percent_b=min_bb_percent_b,
            max_bb_percent_b=max_bb_percent_b,
            filter_out_otc=filter_out_otc,
            bullish_candlestick_patterns_only=bullish_candlestick_patterns_only
        )

        if results.empty:
            return jsonify({
                'success': False,
                'message': 'No symbols found matching the criteria.',
                'count': 0
            })

        # Create TradingView links for stock names
        def create_tradingview_link(row):
            symbol = row['name']
            exchange = row['exchange']

            # Map exchange names to TradingView format
            exchange_mapping = {
                'NASDAQ': 'NASDAQ',
                'NYSE': 'NYSE',
                'NYSE AMERICAN': 'NYSEAMERICAN',
                'NYSE ARCA': 'NYSEARCA',
                'CBOE': 'CBOE',
                'CBOE BZX': 'CBOEBZX',
                'CBOE BYX': 'CBOEBYX',
                'CBOE EDGX': 'CBOEEDGX',
                'CBOE EDGA': 'CBOEEDGA',
                'IEX': 'IEX',
                'OTC': 'OTC',
                'OTC MARKETS': 'OTCMARKETS',
                'PHILADELPHIA STOCK EXCHANGE': 'PHLX',
                'NYSE CHICAGO': 'NYSECHICAGO',
                'NATIONAL STOCK EXCHANGE': 'NSX',
                'NASDAQBX': 'NASDAQBX',
                'BATS': 'BATS',
                'INSTINET': 'INSTINET'
            }

            tv_exchange = exchange_mapping.get(exchange, exchange)

            # Create a more mobile-friendly TradingView link
            # Use the symbol format that works better with mobile apps
            # Format: EXCHANGE-SYMBOL (with hyphen, not colon)
            symbol_pair = f"{tv_exchange}-{symbol}"
            encoded_symbol = urllib.parse.quote(symbol_pair)

            # Use the format that works with mobile apps, including UTM parameters
            return f"https://www.tradingview.com/symbols/{encoded_symbol}/?utm_source=androidapp&utm_medium=share"

        # Add TradingView links to the results
        results['tradingview_link'] = results.apply(create_tradingview_link, axis=1)

        # Create CSV buffer (without tradingview_link column for cleaner CSV)
        csv_export_df = results.drop(columns=['tradingview_link'])
        csv_buffer = io.StringIO()
        csv_export_df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)

        # Prepare all data (replace NaN/NA with None)
        all_data_df = results.replace({pd.NA: None, float('nan'): None, math.nan: None})
        all_data = all_data_df.to_dict(orient='records')
        # Remove tradingview_link column from display columns but keep it in the data for links
        display_columns = [col for col in results.columns if col != 'tradingview_link']

        # Create response with CSV data and all results
        response_data = {
            'success': True,
            'count': len(results),
            'message': f'Found {len(results)} symbols!',
            'csv_data': csv_buffer.getvalue(),
            'filename': f"screener_results_{datetime.today().strftime('%Y%m%d')}.csv",
            'data': all_data,
            'columns': display_columns
        }

        return jsonify(response_data)

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error processing query: {str(e)}',
            'count': 0
        }), 500


@app.route('/api/download', methods=['POST'])
def download_csv():
    try:
        data = request.get_json()
        csv_data = data.get('csv_data')
        filename = data.get('filename', 'screener_results.csv')

        if not csv_data:
            return jsonify({'error': 'No CSV data provided'}), 400

        # Create BytesIO buffer for file download
        buffer = io.BytesIO()
        buffer.write(csv_data.encode('utf-8'))
        buffer.seek(0)

        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype='text/csv'
        )

    except Exception as e:
        return jsonify({'error': f'Error creating download: {str(e)}'}), 500


@app.route('/api/screeners', methods=['GET'])
def get_screeners():
    """Get all saved screeners with user filtering"""
    try:
        user_info = get_user_info()
        user_id = user_info['user_id'] if user_info else None
        include_public = request.args.get('include_public', 'true').lower() == 'true'
        search_term = request.args.get('search', '')

        if search_term:
            screeners = mongodb_manager.search_screeners(search_term)
            # Apply user filtering to search results
            if user_id:
                screeners = [s for s in screeners if s.get('user_id') == user_id or s.get('is_public', False)]
            elif not include_public:
                screeners = [s for s in screeners if s.get('is_public', False)]
        else:
            screeners = mongodb_manager.get_all_screeners(user_id, include_public)

        return jsonify({
            'success': True,
            'screeners': screeners
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving screeners: {str(e)}'
        }), 500


@app.route('/api/screeners', methods=['POST'])
def save_screener():
    """Save a new screener"""
    try:
        data = request.get_json()

        # Validate required fields
        required_fields = ['name', 'owner', 'params']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({
                    'success': False,
                    'message': f'Missing required field: {field}'
                }), 400

        # Handle optional tags
        tags = data.get('tags', '').strip()
        if not tags:
            tags = ''  # Empty string for no tags

        # Get user info for authentication
        user_info = get_user_info()
        if not user_info:
            return jsonify({
                'success': False,
                'message': 'Authentication required to save screeners'
            }), 401

        # Get public/private setting
        is_public = data.get('is_public', False)

        # Save screener with user info
        screener_id = mongodb_manager.save_screener(
            name=data['name'],
            owner=data['owner'],
            tags=data['tags'],
            params=data['params'],
            user_id=user_info['user_id'],
            is_public=is_public
        )

        return jsonify({
            'success': True,
            'message': 'Screener saved successfully!',
            'screener_id': screener_id
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error saving screener: {str(e)}'
        }), 500


@app.route('/api/screeners/<screener_id>', methods=['GET'])
def get_screener(screener_id):
    """Get a specific screener by ID"""
    try:
        screener = mongodb_manager.get_screener_by_id(screener_id)
        if screener:
            return jsonify({
                'success': True,
                'screener': screener
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Screener not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error retrieving screener: {str(e)}'
        }), 500


@app.route('/api/screeners/<screener_id>', methods=['DELETE'])
def delete_screener(screener_id):
    """Delete a screener"""
    try:
        data = request.get_json()
        confirmation_name = data.get('confirmation_name', '')

        # Get the screener to check the name
        screener = mongodb_manager.get_screener_by_id(screener_id)
        if not screener:
            return jsonify({
                'success': False,
                'message': 'Screener not found'
            }), 404

        # Check if confirmation name matches
        if confirmation_name != screener['name']:
            return jsonify({
                'success': False,
                'message': 'Confirmation name does not match screener name'
            }), 400

        # Delete the screener
        success = mongodb_manager.delete_screener(screener_id)
        if success:
            return jsonify({
                'success': True,
                'message': 'Screener deleted successfully!'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Error deleting screener'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Error deleting screener: {str(e)}'
        }), 500


# Background worker to check price alerts
def check_price_alerts_worker():
    """Background worker that checks price alerts every 30 seconds"""
    while True:
        try:
            time.sleep(30)  # Check every 30 seconds
            
            # Get all active alerts grouped by symbol
            if mongodb_manager.client is None:
                continue
            
            alerts_collection = mongodb_manager.db.price_alerts
            active_alerts = list(alerts_collection.find({'is_active': True}))
            
            if not active_alerts:
                continue
            
            # Group alerts by symbol
            symbols_by_alert = {}
            for alert in active_alerts:
                symbol = alert.get('symbol', '').upper().strip()
                if symbol:
                    if symbol not in symbols_by_alert:
                        symbols_by_alert[symbol] = []
                    symbols_by_alert[symbol].append(alert)
            
            if not symbols_by_alert:
                continue
            
            # Fetch current prices for all symbols
            symbols = list(symbols_by_alert.keys())
            try:
                price_data = fetch_symbol_quotes(symbols)
            except Exception as e:
                print(f"Error fetching prices for alerts: {e}")
                continue
            
            # Check each alert
            for symbol, alerts in symbols_by_alert.items():
                if symbol not in price_data:
                    continue
                
                current_price = price_data[symbol].get('current', 0)
                current_change_percent = price_data[symbol].get('changePercent', 0)
                
                if current_price <= 0:
                    continue
                
                for alert in alerts:
                    try:
                        alert_type = alert.get('alert_type', 'price')
                        condition = alert.get('condition', 'above')
                        threshold = alert.get('threshold', 0)
                        percentage_change = alert.get('percentage_change')
                        alert_id = str(alert['_id'])
                        
                        triggered = False
                        
                        if alert_type == 'price':
                            if condition == 'above' and current_price >= threshold:
                                triggered = True
                            elif condition == 'below' and current_price <= threshold:
                                triggered = True
                            elif condition == 'equals' and abs(current_price - threshold) < 0.01:
                                triggered = True
                        
                        elif alert_type == 'percentage':
                            if percentage_change is not None:
                                if condition == 'above' and current_change_percent >= percentage_change:
                                    triggered = True
                                elif condition == 'below' and current_change_percent <= percentage_change:
                                    triggered = True
                        
                        if triggered:
                            # Mark alert as triggered
                            mongodb_manager.mark_alert_triggered(
                                alert_id,
                                current_price,
                                current_change_percent
                            )
                            
                            # Store notification in database for in-app display
                            notifications_collection = mongodb_manager.db.alert_notifications
                            notification_method = alert.get('notification_method', 'in_app')

                            notification = {
                                'user_id': alert['user_id'],
                                'alert_id': alert_id,
                                'symbol': symbol,
                                'alert_type': alert_type,
                                'message': f"{symbol} {alert_type} alert triggered: ${current_price:.2f}",
                                'current_price': current_price,
                                'current_change_percent': current_change_percent,
                                'created_at': datetime.utcnow(),
                                'read': False
                            }
                            notifications_collection.insert_one(notification)

                            # Send email notification if configured
                            if _should_send_email(notification_method):
                                user_profile = mongodb_manager.get_user_profile(alert['user_id'])
                                user_email = (user_profile or {}).get('email') if user_profile else None
                                if user_email:
                                    subject = f"{symbol} price alert triggered"
                                    body_lines = [
                                        f"Symbol: {symbol}",
                                        f"Alert Type: {'Price' if alert_type == 'price' else 'Percentage Change'}",
                                        f"Condition: {condition}",
                                        f"Current Price: ${current_price:.2f}",
                                    ]
                                    if alert_type == 'price':
                                        body_lines.append(f"Threshold: ${threshold:.2f}")
                                    else:
                                        body_lines.append(f"Change Percent Threshold: {percentage_change}%")
                                        body_lines.append(f"Current Change Percent: {current_change_percent}%")

                                    if alert.get('notes'):
                                        body_lines.append(f"Notes: {alert['notes']}")

                                    body_lines.append("\nThis alert was generated by your TradingView Screener app.")

                                    send_alert_email(
                                        user_email,
                                        subject,
                                        "\n".join(body_lines)
                                    )
                            
                    except Exception as e:
                        print(f"Error checking alert {alert.get('_id')}: {e}")
                        continue
                        
        except Exception as e:
            print(f"Error in price alerts worker: {e}")
            time.sleep(60)  # Wait longer on error


# Start background worker thread
_alert_worker_thread = None

def start_alert_worker():
    """Start the background alert checking worker"""
    global _alert_worker_thread
    if _alert_worker_thread is None or not _alert_worker_thread.is_alive():
        _alert_worker_thread = threading.Thread(target=check_price_alerts_worker, daemon=True)
        _alert_worker_thread.start()
        print("✅ Price alerts worker started")

# Start alert worker when module is imported (works with both dev and production)
# Use a small delay to ensure MongoDB is connected first
def _delayed_start_worker():
    """Start worker after a short delay to ensure MongoDB is ready"""
    import threading
    def delayed():
        time.sleep(2)  # Wait 2 seconds for MongoDB connection
        start_alert_worker()
    threading.Thread(target=delayed, daemon=True).start()

# Start worker in background
_delayed_start_worker()

if __name__ == '__main__':
    try:
        app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
    except KeyboardInterrupt:
        pass
