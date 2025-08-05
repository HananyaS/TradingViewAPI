import os
import ssl
import certifi
from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId

# Storage configuration
MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb://localhost:27017/')
MONGODB_DB = os.getenv('MONGODB_DB', 'tradingview_screener')
USE_FALLBACK_ONLY = os.getenv('USE_FALLBACK_ONLY', 'false').lower() == 'true'
USE_FILE_STORAGE = os.getenv('USE_FILE_STORAGE', 'false').lower() == 'true'
FORCE_FILE_STORAGE = os.getenv('FORCE_FILE_STORAGE', 'false').lower() == 'true'
# Custom CA file path
CUSTOM_CA_FILE = os.getenv('CUSTOM_CA_FILE', None)

class MongoDBManager:
    def __init__(self):
        # Check if we should force file storage (for SSL issues)
        if FORCE_FILE_STORAGE:
            print("Using file storage (FORCE_FILE_STORAGE=true) - bypassing MongoDB SSL issues")
            from file_storage import FileStorageManager
            self.file_storage = FileStorageManager()
            self.client = None
            self.db = None
            self.screeners_collection = None
            return
            
        # Check if we should use file storage
        if USE_FILE_STORAGE:
            print("Using file storage (USE_FILE_STORAGE=true)")
            from file_storage import FileStorageManager
            self.file_storage = FileStorageManager()
            self.client = None
            self.db = None
            self.screeners_collection = None
            return
            
        # Check if we should use fallback only
        if USE_FALLBACK_ONLY:
            print("Using fallback storage only (USE_FALLBACK_ONLY=true)")
            self.client = None
            self.db = None
            self.screeners_collection = None
            self._fallback_storage = []
            self._fallback_counter = 0
            return
            
        try:
            print("Attempting MongoDB Atlas connection...")
            
            # For MongoDB Atlas with open network access, use OpenSSL-optimized connection
            if MONGODB_URL.startswith('mongodb+srv://'):
                connection_successful = False
                
                # Determine which CA file to use
                ca_file = CUSTOM_CA_FILE if CUSTOM_CA_FILE and os.path.exists(CUSTOM_CA_FILE) else certifi.where()
                print(f"Using CA file: {ca_file}")
                
                # Attempt 1: Strict OpenSSL configuration
                try:
                    print("Attempting with strict OpenSSL configuration...")
                    # Create custom SSL context with OpenSSL optimizations
                    ssl_context = ssl.create_default_context(cafile=ca_file)
                    ssl_context.check_hostname = True
                    ssl_context.verify_mode = ssl.CERT_REQUIRED
                    
                    # OpenSSL-specific settings for Render compatibility
                    ssl_context.set_ciphers('DEFAULT@SECLEVEL=1')
                    ssl_context.options |= ssl.OP_NO_SSLv2
                    ssl_context.options |= ssl.OP_NO_SSLv3
                    ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
                    
                    # Connection with OpenSSL optimizations (modern TLS parameters only)
                    self.client = MongoClient(
                        MONGODB_URL,
                        serverSelectionTimeoutMS=20000,
                        connectTimeoutMS=20000,
                        socketTimeoutMS=20000,
                        # Modern TLS settings with custom CA file
                        tls=True,
                        tlsCAFile=ca_file,
                        tlsAllowInvalidCertificates=False,
                        tlsAllowInvalidHostnames=False
                    )
                    self.client.admin.command('ping')
                    connection_successful = True
                    print("✅ MongoDB Atlas connection successful with custom CA file!")
                except Exception as e:
                    print(f"Strict OpenSSL failed: {str(e)[:200]}...")
                
                # Attempt 2: Relaxed OpenSSL configuration
                if not connection_successful:
                    try:
                        print("Attempting with relaxed OpenSSL configuration...")
                        # Create relaxed SSL context
                        ssl_context = ssl.create_default_context()
                        ssl_context.check_hostname = False
                        ssl_context.verify_mode = ssl.CERT_NONE
                        
                        # Relaxed OpenSSL settings
                        ssl_context.set_ciphers('DEFAULT')
                        
                        # Connection with relaxed OpenSSL settings (modern TLS parameters only)
                        self.client = MongoClient(
                            MONGODB_URL,
                            serverSelectionTimeoutMS=20000,
                            connectTimeoutMS=20000,
                            socketTimeoutMS=20000,
                            # Relaxed TLS settings only
                            tls=True,
                            tlsAllowInvalidCertificates=True,
                            tlsAllowInvalidHostnames=True
                        )
                        self.client.admin.command('ping')
                        connection_successful = True
                        print("✅ MongoDB Atlas connection successful with relaxed OpenSSL!")
                    except Exception as e:
                        print(f"Relaxed OpenSSL failed: {str(e)[:200]}...")
                
                # Attempt 3: NO SSL/TLS (Render emergency fallback)
                if not connection_successful:
                    try:
                        print("Attempting with NO SSL/TLS (Render emergency fallback)...")
                        # Convert mongodb+srv:// to mongodb:// and disable SSL
                        # This is a last resort for Render compatibility
                        connection_string = MONGODB_URL.replace('mongodb+srv://', 'mongodb://')
                        if '?' in connection_string:
                            connection_string += '&ssl=false&ssl_cert_reqs=CERT_NONE'
                        else:
                            connection_string += '?ssl=false&ssl_cert_reqs=CERT_NONE'
                        
                        self.client = MongoClient(
                            connection_string,
                            serverSelectionTimeoutMS=20000,
                            connectTimeoutMS=20000,
                            socketTimeoutMS=20000,
                            # NO TLS/SSL settings
                            tls=False,
                            ssl=False
                        )
                        self.client.admin.command('ping')
                        connection_successful = True
                        print("✅ MongoDB Atlas connection successful with NO SSL/TLS!")
                    except Exception as e:
                        print(f"NO SSL/TLS failed: {str(e)[:200]}...")
                
                # If all attempts failed, raise the last exception
                if not connection_successful:
                    raise Exception("All MongoDB connection attempts failed - SSL handshake issues persist")
                    
            else:
                # For local MongoDB
                self.client = MongoClient(MONGODB_URL)
            
            # Test the connection
            self.client.admin.command('ping')
            print("✅ MongoDB Atlas connection successful!")
            
            self.db = self.client[MONGODB_DB]
            self.screeners_collection = self.db.screeners
            
            # Create indexes for better performance
            self.screeners_collection.create_index([("name", 1)])
            self.screeners_collection.create_index([("owner", 1)])
            self.screeners_collection.create_index([("created_at", -1)])
            
        except Exception as e:
            print(f"❌ MongoDB connection error: {e}")
            print("Falling back to in-memory storage...")
            # Fallback to in-memory storage if MongoDB is not available
            self.client = None
            self.db = None
            self.screeners_collection = None
            self._fallback_storage = []
            self._fallback_counter = 0
    
    def _ensure_string_dates(self, screener):
        """Helper function to ensure dates are strings"""
        screener_copy = screener.copy()
        if not isinstance(screener_copy['created_at'], str):
            screener_copy['created_at'] = screener_copy['created_at'].isoformat()
        if not isinstance(screener_copy['updated_at'], str):
            screener_copy['updated_at'] = screener_copy['updated_at'].isoformat()
        return screener_copy
    
    def save_screener(self, name, owner, tags, params, user_id=None, is_public=False):
        """Save a screener configuration"""
        # Check if using file storage
        if hasattr(self, 'file_storage'):
            return self.file_storage.save_screener(name, owner, tags, params, user_id, is_public)
            
        screener_data = {
            'name': name,
            'owner': owner,
            'tags': tags,
            'params': params,
            'user_id': user_id,
            'is_public': is_public,
            'created_at': datetime.utcnow(),
            'updated_at': datetime.utcnow()
        }
        
        if self.screeners_collection is not None:
            # Use MongoDB
            result = self.screeners_collection.insert_one(screener_data)
            return str(result.inserted_id)
        else:
            # Use fallback storage
            self._fallback_counter += 1
            screener_data['_id'] = str(self._fallback_counter)
            self._fallback_storage.append(screener_data)
            return str(self._fallback_counter)
    
    def get_all_screeners(self, user_id=None, include_public=True):
        """Get all saved screeners with user filtering"""
        # Check if using file storage
        if hasattr(self, 'file_storage'):
            return self.file_storage.get_all_screeners(user_id, include_public)
            
        if self.screeners_collection is not None:
            # Use MongoDB with filtering
            query = {}
            if user_id:
                # Get user's screeners and public screeners
                query = {
                    '$or': [
                        {'user_id': user_id},
                        {'is_public': True}
                    ]
                } if include_public else {'user_id': user_id}
            elif not include_public:
                # If no user_id and not including public, return empty
                return []
            
            screeners = list(self.screeners_collection.find(query).sort('created_at', -1))
            # Convert ObjectId to string for JSON serialization
            for screener in screeners:
                screener['_id'] = str(screener['_id'])
                screener['created_at'] = screener['created_at'].isoformat()
                screener['updated_at'] = screener['updated_at'].isoformat()
            return screeners
        else:
            # Use fallback storage with filtering
            screeners = []
            for screener in self._fallback_storage:
                # Apply filtering logic
                if user_id:
                    if include_public:
                        if screener.get('user_id') == user_id or screener.get('is_public', False):
                            screeners.append(self._ensure_string_dates(screener))
                    else:
                        if screener.get('user_id') == user_id:
                            screeners.append(self._ensure_string_dates(screener))
                elif include_public:
                    # No user_id but include public screeners
                    if screener.get('is_public', False):
                        screeners.append(self._ensure_string_dates(screener))
            
            # Sort by created_at (now all strings)
            screeners.sort(key=lambda x: x['created_at'], reverse=True)
            return screeners
    
    def get_screener_by_id(self, screener_id):
        """Get a specific screener by ID"""
        # Check if using file storage
        if hasattr(self, 'file_storage'):
            return self.file_storage.get_screener_by_id(screener_id)
            
        if self.screeners_collection is not None:
            # Use MongoDB
            try:
                screener = self.screeners_collection.find_one({'_id': ObjectId(screener_id)})
                if screener:
                    screener['_id'] = str(screener['_id'])
                    screener['created_at'] = screener['created_at'].isoformat()
                    screener['updated_at'] = screener['updated_at'].isoformat()
                return screener
            except:
                return None
        else:
            # Use fallback storage
            for screener in self._fallback_storage:
                if screener['_id'] == screener_id:
                    return self._ensure_string_dates(screener)
            return None
    
    def delete_screener(self, screener_id):
        """Delete a screener by ID"""
        # Check if using file storage
        if hasattr(self, 'file_storage'):
            return self.file_storage.delete_screener(screener_id)
            
        if self.screeners_collection is not None:
            # Use MongoDB
            try:
                result = self.screeners_collection.delete_one({'_id': ObjectId(screener_id)})
                return result.deleted_count > 0
            except:
                return False
        else:
            # Use fallback storage
            for i, screener in enumerate(self._fallback_storage):
                if screener['_id'] == screener_id:
                    del self._fallback_storage[i]
                    return True
            return False
    
    def search_screeners(self, search_term):
        """Search screeners by name, owner, or tags"""
        # Check if using file storage
        if hasattr(self, 'file_storage'):
            return self.file_storage.search_screeners(search_term)
            
        if self.screeners_collection is not None:
            # Use MongoDB
            query = {
                '$or': [
                    {'name': {'$regex': search_term, '$options': 'i'}},
                    {'owner': {'$regex': search_term, '$options': 'i'}},
                    {'tags': {'$regex': search_term, '$options': 'i', '$ne': ''}}
                ]
            }
            screeners = list(self.screeners_collection.find(query).sort('created_at', -1))
            for screener in screeners:
                screener['_id'] = str(screener['_id'])
                screener['created_at'] = screener['created_at'].isoformat()
                screener['updated_at'] = screener['updated_at'].isoformat()
            return screeners
        else:
            # Use fallback storage
            search_term_lower = search_term.lower()
            screeners = []
            for screener in self._fallback_storage:
                if (search_term_lower in screener['name'].lower() or
                    search_term_lower in screener['owner'].lower() or
                    (screener['tags'] and search_term_lower in screener['tags'].lower())):
                    screeners.append(self._ensure_string_dates(screener))
            
            # Sort by created_at (now all strings)
            screeners.sort(key=lambda x: x['created_at'], reverse=True)
            return screeners

    # Price cache methods
    def get_price_cache(self, symbol):
        """Get cached price for a symbol"""
        try:
            if self.client is None:
                # Use fallback storage - for now return None
                return None
            
            # Use MongoDB price cache collection
            price_collection = self.db.price_cache
            price_doc = price_collection.find_one({'symbol': symbol.upper()})
            return price_doc
        except Exception as e:
            print(f"Error getting price cache for {symbol}: {e}")
            return None

    def update_price_cache(self, symbol, current_price, change, change_percent):
        """Update cached price for a symbol"""
        try:
            if self.client is None:
                # Use fallback storage - for now just log
                print(f"Price cache update (fallback): {symbol} = ${current_price}")
                return
            
            # Use MongoDB price cache collection
            price_collection = self.db.price_cache
            
            # Create or update price document
            price_doc = {
                'symbol': symbol.upper(),
                'current_price': current_price,
                'change': change,
                'change_percent': change_percent,
                'last_update': datetime.utcnow()
            }
            
            # Upsert the document
            price_collection.update_one(
                {'symbol': symbol.upper()},
                {'$set': price_doc},
                upsert=True
            )
            
            print(f"✅ Updated price cache for {symbol}: ${current_price}")
        except Exception as e:
            print(f"Error updating price cache for {symbol}: {e}")

    def get_multiple_price_cache(self, symbols):
        """Get cached prices for multiple symbols"""
        try:
            if self.client is None:
                # Use fallback storage - for now return empty dict
                return {}
            
            # Use MongoDB price cache collection
            price_collection = self.db.price_cache
            
            # Find all symbols in one query
            cursor = price_collection.find({
                'symbol': {'$in': [s.upper() for s in symbols]}
            })
            
            prices = {}
            for doc in cursor:
                prices[doc['symbol']] = {
                    'current': doc['current_price'],
                    'change': doc['change'],
                    'changePercent': doc['change_percent'],
                    'lastUpdate': doc['last_update'].isoformat()
                }
            
            return prices
        except Exception as e:
            print(f"Error getting multiple price cache: {e}")
            return {}

    def clear_old_price_cache(self, hours=24):
        """Clear old price cache entries (older than specified hours)"""
        try:
            if self.client is None:
                # Use fallback storage - nothing to clear
                return
            
            # Use MongoDB price cache collection
            price_collection = self.db.price_cache
            
            # Calculate cutoff time
            from datetime import timedelta
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            
            # Delete old entries
            result = price_collection.delete_many({
                'last_update': {'$lt': cutoff_time}
            })
            
            print(f"✅ Cleared {result.deleted_count} old price cache entries")
        except Exception as e:
            print(f"Error clearing old price cache: {e}")

    # Trades collection methods
    def save_trade(self, user_id, trade_data):
        """Save a trade for a user"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_trades'):
                    self._fallback_trades = []
                
                self._fallback_counter += 1
                trade_doc = {
                    '_id': str(self._fallback_counter),
                    'user_id': user_id,
                    **trade_data,
                    'created_at': datetime.utcnow()
                }
                self._fallback_trades.append(trade_doc)
                return str(self._fallback_counter)
            
            # Use MongoDB trades collection
            trades_collection = self.db.trades
            
            # Create trade document
            trade_doc = {
                'user_id': user_id,
                **trade_data,
                'created_at': datetime.utcnow()
            }
            
            result = trades_collection.insert_one(trade_doc)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error saving trade: {e}")
            return None

    def get_user_trades(self, user_id):
        """Get all trades for a user"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_trades'):
                    self._fallback_trades = []
                
                user_trades = []
                for trade in self._fallback_trades:
                    if trade.get('user_id') == user_id:
                        trade_copy = trade.copy()
                        trade_copy['_id'] = str(trade_copy['_id'])
                        trade_copy['created_at'] = trade_copy['created_at'].isoformat()
                        user_trades.append(trade_copy)
                
                return user_trades
            
            # Use MongoDB trades collection
            trades_collection = self.db.trades
            
            trades = list(trades_collection.find({'user_id': user_id}).sort('created_at', -1))
            
            # Convert ObjectId to string and dates to ISO format
            for trade in trades:
                trade['_id'] = str(trade['_id'])
                trade['created_at'] = trade['created_at'].isoformat()
            
            return trades
            
        except Exception as e:
            print(f"Error getting user trades: {e}")
            return []

    def delete_trade(self, user_id, trade_id):
        """Delete a trade for a user"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_trades'):
                    self._fallback_trades = []
                
                for i, trade in enumerate(self._fallback_trades):
                    if trade.get('_id') == trade_id and trade.get('user_id') == user_id:
                        del self._fallback_trades[i]
                        return True
                return False
            
            # Use MongoDB trades collection
            trades_collection = self.db.trades
            
            try:
                result = trades_collection.delete_one({
                    '_id': ObjectId(trade_id),
                    'user_id': user_id
                })
                return result.deleted_count > 0
            except:
                return False
            
        except Exception as e:
            print(f"Error deleting trade: {e}")
            return False

    def update_trade(self, user_id, trade_id, trade_data):
        """Update a trade for a user"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_trades'):
                    self._fallback_trades = []
                
                for trade in self._fallback_trades:
                    if trade.get('_id') == trade_id and trade.get('user_id') == user_id:
                        trade.update(trade_data)
                        trade['updated_at'] = datetime.utcnow()
                        return True
                return False
            
            # Use MongoDB trades collection
            trades_collection = self.db.trades
            
            try:
                trade_data['updated_at'] = datetime.utcnow()
                result = trades_collection.update_one(
                    {
                        '_id': ObjectId(trade_id),
                        'user_id': user_id
                    },
                    {'$set': trade_data}
                )
                return result.modified_count > 0
            except:
                return False
            
        except Exception as e:
            print(f"Error updating trade: {e}")
            return False

    # Watchlist collection methods
    def save_watchlist_item(self, user_id, item_data):
        """Save a watchlist item for a user"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_watchlist'):
                    self._fallback_watchlist = []
                
                self._fallback_counter += 1
                item_doc = {
                    '_id': str(self._fallback_counter),
                    'user_id': user_id,
                    **item_data,
                    'created_at': datetime.utcnow()
                }
                self._fallback_watchlist.append(item_doc)
                return str(self._fallback_counter)
            
            # Use MongoDB watchlist collection
            watchlist_collection = self.db.watchlist
            
            # Create watchlist item document
            item_doc = {
                'user_id': user_id,
                **item_data,
                'created_at': datetime.utcnow()
            }
            
            result = watchlist_collection.insert_one(item_doc)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error saving watchlist item: {e}")
            return None

    def get_user_watchlist(self, user_id):
        """Get all watchlist items for a user"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_watchlist'):
                    self._fallback_watchlist = []
                
                user_items = []
                for item in self._fallback_watchlist:
                    if item.get('user_id') == user_id:
                        item_copy = item.copy()
                        item_copy['_id'] = str(item_copy['_id'])
                        item_copy['created_at'] = item_copy['created_at'].isoformat()
                        user_items.append(item_copy)
                
                return user_items
            
            # Use MongoDB watchlist collection
            watchlist_collection = self.db.watchlist
            
            items = list(watchlist_collection.find({'user_id': user_id}).sort('created_at', -1))
            
            # Convert ObjectId to string and dates to ISO format
            for item in items:
                item['_id'] = str(item['_id'])
                item['created_at'] = item['created_at'].isoformat()
            
            return items
            
        except Exception as e:
            print(f"Error getting user watchlist: {e}")
            return []

    def delete_watchlist_item(self, user_id, item_id):
        """Delete a watchlist item for a user"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_watchlist'):
                    self._fallback_watchlist = []
                
                for i, item in enumerate(self._fallback_watchlist):
                    if item.get('_id') == item_id and item.get('user_id') == user_id:
                        del self._fallback_watchlist[i]
                        return True
                return False
            
            # Use MongoDB watchlist collection
            watchlist_collection = self.db.watchlist
            
            try:
                result = watchlist_collection.delete_one({
                    '_id': ObjectId(item_id),
                    'user_id': user_id
                })
                return result.deleted_count > 0
            except:
                return False
            
        except Exception as e:
            print(f"Error deleting watchlist item: {e}")
            return False

    def update_watchlist_item(self, user_id, item_id, item_data):
        """Update a watchlist item for a user"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_watchlist'):
                    self._fallback_watchlist = []
                
                for item in self._fallback_watchlist:
                    if item.get('_id') == item_id and item.get('user_id') == user_id:
                        item.update(item_data)
                        item['updated_at'] = datetime.utcnow()
                        return True
                return False
            
            # Use MongoDB watchlist collection
            watchlist_collection = self.db.watchlist
            
            try:
                item_data['updated_at'] = datetime.utcnow()
                result = watchlist_collection.update_one(
                    {
                        '_id': ObjectId(item_id),
                        'user_id': user_id
                    },
                    {'$set': item_data}
                )
                return result.modified_count > 0
            except:
                return False
            
        except Exception as e:
            print(f"Error updating watchlist item: {e}")
            return False

# Global MongoDB manager instance
mongodb_manager = MongoDBManager() 