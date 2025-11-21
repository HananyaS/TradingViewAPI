from flask import Flask, request, jsonify, send_file, session, redirect
from flask_cors import CORS
import io
import json
from datetime import datetime
import pandas as pd
import math
import urllib.parse
from bson import ObjectId
from screener_service import query_by_params, fetch_symbol_quotes
from mongodb_config import mongodb_manager
from google_oauth import create_oauth_flow, login_required, get_user_info, verify_google_token
from auth_tokens import generate_token, verify_token, revoke_token
from filter_schemas import ScreenerRequest, ScreenerResponse, FieldsMetadata, FieldMetadata
from filter_serializer import FilterSerializer
from pydantic import ValidationError
import os
from react_routes import register_react_routes

# Load environment variables from .env file for local development
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("✅ Loaded environment variables from .env file")
except ImportError:
    print("⚠️ python-dotenv not installed. Install with: pip install python-dotenv")
except FileNotFoundError:
    print("⚠️ .env file not found. Run: python local_setup.py")

# Allow OAuth2 to work with HTTP for local development
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'your-secret-key-change-this')

# Configure CORS to allow credentials (cookies/session) from React dev server
CORS(app, supports_credentials=True, origins=['http://localhost:5173', 'http://localhost:5173'])

# Configure session cookie settings 
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Lax allows cookies in top-level navigation
app.config['SESSION_COOKIE_SECURE'] = False  # Can be False for HTTP (localhost)
app.config['SESSION_COOKIE_HTTPONLY'] = False  # Allow JavaScript access for debugging (TEMP - change to True in production)
app.config['SESSION_COOKIE_DOMAIN'] = 'localhost'  # Explicitly set to 'localhost' (works for both localhost:5000 and localhost:5173, but NOT 127.0.0.1)
app.config['SESSION_COOKIE_PATH'] = '/'  # Make cookie available for all paths
app.config['SESSION_COOKIE_NAME'] = 'session'  # Session cookie name
app.config['PERMANENT_SESSION_LIFETIME'] = 86400  # 24 hours in seconds
app.config['SESSION_REFRESH_EACH_REQUEST'] = False  # Don't regenerate session on each request

# Initialize filter serializer with field metadata
_filter_serializer = None

register_react_routes(app)

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

@app.route('/api/test-filter', methods=['POST'])
def test_filter():
    """Test endpoint for debugging filter issues"""
    try:
        print("🧪 Test filter endpoint called")
        
        # Create a simple test request
        from filter_schemas import ScreenerRequest, FilterGroup, FilterRule, FilterOperand, OperatorType, LogicalOperator
        
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
        
        print("✅ Test request created")
        
        # Get filter serializer
        serializer = get_filter_serializer()
        
        # Try to serialize
        print("🚀 Testing serialization...")
        query = serializer.serialize_screener_request(request)
        
        print("✅ Serialization successful!")
        
        # Try to execute
        print("📡 Testing query execution...")
        columns, results_df = query.get_scanner_data()
        
        print(f"✅ Query execution successful! Got {len(results_df)} results")
        
        return jsonify({
            'success': True,
            'message': 'Test filter worked successfully',
            'count': len(results_df),
            'columns': list(columns) if columns else []
        })
        
    except Exception as e:
        print(f"❌ Test filter failed: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'message': f'Test filter failed: {str(e)}'
        }), 500

@app.route('/login')
def login():
    """Initiate Google OAuth login"""
    try:
        flow = create_oauth_flow()
        authorization_url, state = flow.authorization_url()
        session['state'] = state
        print(f"Redirecting to: {authorization_url}")
        return redirect(authorization_url)
    except Exception as e:
        print(f"Login error: {e}")
        return redirect(f'http://localhost:5173/login?error=Login+error:+{str(e)}')

@app.route('/oauth2callback')
def oauth2callback():
    """Handle Google OAuth callback"""
    try:
        print(f"\n=== OAuth Callback ===")
        print(f"Request URL: {request.url}")
        print(f"Request Host header: {request.headers.get('Host', 'NOT SET')}")
        print(f"Request args: {request.args}")
        print("=====================\n")
        
        flow = create_oauth_flow()
        flow.fetch_token(authorization_response=request.url)
        
        print(f"✅ Successfully fetched token from Google")
        
        # Get user info from Google
        credentials = flow.credentials
        print(f"ID Token exists: {credentials.id_token is not None}")
        
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
            
            print(f"\n=== OAuth Success ===")
            print(f"User authenticated: {id_info['email']}")
            if user_profile:
                print(f"First login date: {user_profile.get('first_login_date')}")
            
            # Generate authentication token (bypasses cookie issues!)
            token = generate_token({
                'user_id': id_info['user_id'],
                'email': id_info['email'],
                'name': id_info['name'],
                'picture': id_info['picture']
            })
            
            print(f"Generated auth token: {token[:20]}...")
            print(f"Redirecting to React app with token...")
            print("=====================\n")
            
            # Redirect to React with token in URL (React will capture and store it)
            return redirect(f'http://localhost:5173/?auth_token={token}')
        else:
            print("Invalid Google token")
            return redirect('http://localhost:5173/login?error=Invalid+Google+token')
            
    except Exception as e:
        error_msg = f'OAuth Error: {str(e)}'
        print(f"\n❌ OAuth Error: {e}")
        import traceback
        traceback.print_exc()
        print("=====================\n")
        return redirect(f'http://localhost:5173/login?error={error_msg}')

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
    
    print("\n=== /api/user request ===")
    print(f"Authorization header present: {bool(auth_header)}")
    print(f"Token: {token[:20] + '...' if token else 'None'}")
    
    # Verify token
    user_data = verify_token(token)
    
    if user_data:
        print(f"✅ Token valid! User: {user_data.get('email')}")
        print("========================\n")
        return jsonify({
            'authenticated': True,
            'user_id': user_data['user_id'],
            'email': user_data['email'],
            'name': user_data['name'],
            'picture': user_data['picture']
        })
    else:
        print(f"❌ No valid token")
        print("========================\n")
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
        data = request.get_json()
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
        data = request.get_json()
        
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
        print('symbols', symbols)
        
        if not symbols:
            return jsonify({'success': False, 'error': 'No symbols provided'})
        
        # Fetch live prices using TradingView screener
        print(f"[prices.fetch] Fetching live prices for symbols: {symbols}")
        live_prices = fetch_symbol_quotes(symbols)
        print(f"[prices.fetch] Screener response: {live_prices}")
        
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


@app.route('/api/fields', methods=['GET'])
def get_fields_metadata():
    """Get field metadata for the dynamic filter builder"""
    try:
        print("🔍 Loading field metadata from static/fields.json...")
        
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
        
        print(f"✅ Loaded {len(fields_data['fields'])} fields in {len(fields_data['groups'])} groups")
        
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
        
        # Debug logging
        print(f"🔍 Received dynamic screener request: {json.dumps(data, indent=2)}")
        
        # Validate request using Pydantic
        try:
            # First check the raw data structure
            print(f"🔍 Raw data validation:")
            print(f"   Type: {type(data)}")
            if isinstance(data, dict):
                print(f"   Keys: {list(data.keys())}")
                if 'filter_groups' in data:
                    print(f"   filter_groups type: {type(data['filter_groups'])}")
                    if isinstance(data['filter_groups'], list):
                        print(f"   filter_groups length: {len(data['filter_groups'])}")
                    else:
                        print(f"   ❌ filter_groups is not a list: {data['filter_groups']}")
            
            screener_request = ScreenerRequest(**data)
            print(f"✅ Request validation successful")
            print(f"📋 Filter groups: {len(screener_request.filter_groups)}")
            for i, group in enumerate(screener_request.filter_groups):
                print(f"   Group {i}: {len(group.rules)} rules, enabled={group.enabled}")
                for j, rule in enumerate(group.rules):
                    print(f"     Rule {j}: {rule.left_operand.value} {rule.operator} {rule.right_operand.value}")
        except ValidationError as e:
            print(f"❌ Request validation failed: {e}")
            print(f"   Validation errors: {e.errors()}")
            return jsonify({
                'success': False,
                'message': 'Invalid request format',
                'errors': e.errors()
            }), 400
        except Exception as e:
            print(f"❌ Unexpected error during validation: {e}")
            import traceback
            traceback.print_exc()
            return jsonify({
                'success': False,
                'message': f'Unexpected validation error: {str(e)}'
            }), 500
        
        # Get filter serializer
        serializer = get_filter_serializer()
        
        # Use dynamic TradingView Query serialization
        print(f"🚀 Building dynamic TradingView query...")
        try:
            query = serializer.serialize_screener_request(screener_request)
            print(f"📋 Query built successfully with {len(screener_request.filter_groups)} filter groups")
            
            # Execute the query
            print(f"📡 Executing TradingView query...")
            columns, results_df = query.get_scanner_data()
            
            print(f"✅ Query executed successfully: {len(results_df)} results")

        except Exception as query_error:
            print(f"❌ Error building or executing TradingView query: {query_error}")
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
        
        # Debug logging
        print(f"🔍 Received query data: {data}")
        
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
        
        # Debug logging for extracted parameters
        print(f"📊 Extracted parameters:")
        print(f"   min_change: {min_change} (type: {type(min_change)})")
        print(f"   max_change: {max_change} (type: {type(max_change)})")
        print(f"   min_rsi: {min_rsi} (type: {type(min_rsi)})")
        print(f"   max_rsi: {max_rsi} (type: {type(max_rsi)})")
        print(f"   min_bb_percent_b: {min_bb_percent_b} (type: {type(min_bb_percent_b)})")
        print(f"   max_bb_percent_b: {max_bb_percent_b} (type: {type(max_bb_percent_b)})")
        

        
        # Debug logging before calling query_by_params
        print(f"🚀 Calling query_by_params with:")
        print(f"   min_change: {min_change}")
        print(f"   max_change: {max_change}")
        print(f"   min_rsi: {min_rsi}")
        print(f"   max_rsi: {max_rsi}")
        print(f"   min_bb_percent_b: {min_bb_percent_b}")
        print(f"   max_bb_percent_b: {max_bb_percent_b}")
        
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

if __name__ == '__main__':
    # Debug MongoDB connection
    print("=== MongoDB Connection Debug ===")
    print(f"MONGODB_URL: {os.getenv('MONGODB_URL', 'Not set')[:50]}...")
    print(f"MONGODB_DB: {os.getenv('MONGODB_DB', 'Not set')}")
    print(f"USE_FALLBACK_ONLY: {os.getenv('USE_FALLBACK_ONLY', 'false')}")
    print(f"USE_FILE_STORAGE: {os.getenv('USE_FILE_STORAGE', 'false')}")
    print("================================")
    
    try:
        app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
    except KeyboardInterrupt:
        print("✅ Application stopped")