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

    # News cache methods - per symbol caching
    def get_symbol_news_cache(self, symbol):
        """Get cached news for a specific symbol (global cache, not per user)"""
        try:
            if self.client is None:
                return None
            
            news_collection = self.db.news_cache
            symbol_upper = symbol.upper().strip()
            
            cache_doc = news_collection.find_one({
                'symbol': symbol_upper,
                'type': 'symbol'
            })
            
            if cache_doc:
                # Check if cache is still valid (less than 1 minute old)
                from datetime import timedelta
                cache_age = datetime.utcnow() - cache_doc['cached_at']
                if cache_age < timedelta(minutes=1):
                    return cache_doc.get('stories', [])
                else:
                    # Cache expired, delete it
                    news_collection.delete_one({'_id': cache_doc['_id']})
            
            return None
        except Exception as e:
            print(f"Error getting symbol news cache for {symbol}: {e}")
            return None

    def set_symbol_news_cache(self, symbol, stories):
        """Cache news stories for a specific symbol (global cache)"""
        try:
            if self.client is None:
                return
            
            news_collection = self.db.news_cache
            symbol_upper = symbol.upper().strip()
            
            # Create or update cache document
            cache_doc = {
                'symbol': symbol_upper,
                'type': 'symbol',
                'stories': stories,
                'cached_at': datetime.utcnow()
            }
            
            # Upsert the document
            news_collection.update_one(
                {'symbol': symbol_upper, 'type': 'symbol'},
                {'$set': cache_doc},
                upsert=True
            )
            print(f"[news cache] Cached {len(stories)} stories for symbol {symbol_upper}")
        except Exception as e:
            print(f"Error setting symbol news cache for {symbol}: {e}")

    def get_multiple_symbols_news_cache(self, symbols):
        """Get cached news for multiple symbols, return dict of symbol -> stories"""
        try:
            if self.client is None:
                return {}
            
            news_collection = self.db.news_cache
            symbols_upper = [s.upper().strip() for s in symbols if s and s.strip()]
            
            if not symbols_upper:
                return {}
            
            # Find all cached symbols
            cache_docs = news_collection.find({
                'symbol': {'$in': symbols_upper},
                'type': 'symbol'
            })
            
            cached_results = {}
            from datetime import timedelta
            current_time = datetime.utcnow()
            
            for doc in cache_docs:
                symbol = doc['symbol']
                cache_age = current_time - doc['cached_at']
                
                if cache_age < timedelta(minutes=1):
                    cached_results[symbol] = doc.get('stories', [])
                else:
                    # Cache expired, delete it
                    news_collection.delete_one({'_id': doc['_id']})
            
            return cached_results
        except Exception as e:
            print(f"Error getting multiple symbols news cache: {e}")
            return {}

    # Legacy methods for user-based cache (for story types)
    def get_news_cache(self, user_id, cache_key):
        """Get cached news for a user and cache key (for story types)"""
        try:
            if self.client is None:
                return None
            
            news_collection = self.db.news_cache
            cache_doc = news_collection.find_one({
                'user_id': user_id,
                'cache_key': cache_key,
                'type': 'user_query'
            })
            
            if cache_doc:
                # Check if cache is still valid (less than 1 minute old)
                from datetime import timedelta
                cache_age = datetime.utcnow() - cache_doc['cached_at']
                if cache_age < timedelta(minutes=1):
                    return cache_doc.get('stories', [])
                else:
                    # Cache expired, delete it
                    news_collection.delete_one({'_id': cache_doc['_id']})
            
            return None
        except Exception as e:
            print(f"Error getting news cache: {e}")
            return None

    def set_news_cache(self, user_id, cache_key, stories):
        """Cache news stories for a user (for story types)"""
        try:
            if self.client is None:
                return
            
            news_collection = self.db.news_cache
            
            # Create or update cache document
            cache_doc = {
                'user_id': user_id,
                'cache_key': cache_key,
                'type': 'user_query',
                'stories': stories,
                'cached_at': datetime.utcnow()
            }
            
            # Upsert the document
            news_collection.update_one(
                {'user_id': user_id, 'cache_key': cache_key, 'type': 'user_query'},
                {'$set': cache_doc},
                upsert=True
            )
        except Exception as e:
            print(f"Error setting news cache: {e}")

    def get_user_last_news_fetch(self, user_id):
        """Get the last time a user fetched news (for rate limiting)"""
        try:
            if self.client is None:
                return None
            
            news_collection = self.db.news_cache
            
            # Find the most recent cache entry for this user (any type)
            latest = news_collection.find_one(
                {'user_id': user_id},
                sort=[('cached_at', -1)]
            )
            
            if latest:
                return latest.get('cached_at')
            return None
        except Exception as e:
            print(f"Error getting user last news fetch: {e}")
            return None

    # Batch news cache methods with index
    def get_news_cache_index(self, user_id, cache_type):
        """Get cache index entry for fast lookup (cache_type: 'tickers' or 'story_types')"""
        try:
            if self.client is None:
                return None
            
            index_collection = self.db.news_cache_index
            index_doc = index_collection.find_one({
                'user_id': user_id,
                'cache_type': cache_type
            })
            
            if index_doc:
                # Check if cache is still valid (less than 2 minutes old for unified, 1 minute for others)
                from datetime import timedelta
                cache_age = datetime.utcnow() - index_doc['cached_at']
                max_age = timedelta(minutes=2) if cache_type == 'unified' else timedelta(minutes=1)
                if cache_age < max_age:
                    return index_doc
                else:
                    # Cache expired, delete index and batch data
                    index_collection.delete_one({'_id': index_doc['_id']})
                    batch_collection = self.db.news_cache_batch
                    batch_collection.delete_one({
                        'user_id': user_id,
                        'cache_type': cache_type
                    })
            
            return None
        except Exception as e:
            print(f"Error getting news cache index: {e}")
            return None

    def get_news_cache_batch(self, user_id, cache_type):
        """Get cached batch news data"""
        try:
            if self.client is None:
                return None
            
            # Check index first
            index = self.get_news_cache_index(user_id, cache_type)
            if not index:
                return None
            
            batch_collection = self.db.news_cache_batch
            batch_doc = batch_collection.find_one({
                'user_id': user_id,
                'cache_type': cache_type
            })
            
            if batch_doc:
                return batch_doc.get('data', {})
            
            return None
        except Exception as e:
            print(f"Error getting news cache batch: {e}")
            return None

    def check_tickers_in_cache(self, user_id, requested_tickers):
        """Check if all requested tickers are already in the cache"""
        try:
            if self.client is None:
                return False, None
            
            # Normalize requested tickers
            requested_set = set([t.upper().strip() for t in requested_tickers if t and t.strip()])
            if not requested_set:
                return False, None
            
            # Check if we have cached batch data
            cached_batch = self.get_news_cache_batch(user_id, 'tickers')
            if not cached_batch:
                return False, None
            
            # Get cached tickers from the batch data
            cached_tickers = set()
            if isinstance(cached_batch, dict):
                # Check if it has a 'tickers' field
                if 'tickers' in cached_batch:
                    cached_tickers = set([t.upper().strip() for t in cached_batch['tickers'] if t])
                # Also check 'by_ticker' keys
                elif 'by_ticker' in cached_batch:
                    cached_tickers = set([t.upper().strip() for t in cached_batch['by_ticker'].keys() if t])
            
            # Check if all requested tickers are in cache
            missing_tickers = requested_set - cached_tickers
            if not missing_tickers:
                # All tickers are in cache
                return True, cached_batch
            else:
                # Some tickers are missing
                return False, cached_batch if cached_tickers else None
            
        except Exception as e:
            print(f"Error checking tickers in cache: {e}")
            return False, None

    def check_story_types_in_cache(self, user_id, requested_story_types):
        """Check if all requested story types are already in the cache"""
        try:
            if self.client is None:
                return False, None
            
            # Normalize requested story types
            requested_set = set([st.strip() for st in requested_story_types if st and st.strip()])
            if not requested_set:
                return False, None
            
            # Check if we have cached batch data
            cached_batch = self.get_news_cache_batch(user_id, 'story_types')
            if not cached_batch:
                return False, None
            
            # Get cached story types from the batch data
            if isinstance(cached_batch, dict):
                cached_story_types = set([st.strip() for st in cached_batch.keys() if st])
                
                # Check if all requested story types are in cache
                missing_types = requested_set - cached_story_types
                if not missing_types:
                    # All story types are in cache
                    return True, cached_batch
                else:
                    # Some story types are missing
                    return False, cached_batch if cached_story_types else None
            
            return False, None
            
        except Exception as e:
            print(f"Error checking story types in cache: {e}")
            return False, None

    def set_news_cache_batch(self, user_id, cache_type, data, metadata=None):
        """Cache batch news data with index for fast lookup"""
        try:
            if self.client is None:
                return
            
            from datetime import timedelta
            cached_at = datetime.utcnow()
            
            # Update index
            index_collection = self.db.news_cache_index
            index_doc = {
                'user_id': user_id,
                'cache_type': cache_type,
                'cached_at': cached_at,
                'metadata': metadata or {}
            }
            
            index_collection.update_one(
                {'user_id': user_id, 'cache_type': cache_type},
                {'$set': index_doc},
                upsert=True
            )
            
            # Update batch data
            batch_collection = self.db.news_cache_batch
            batch_doc = {
                'user_id': user_id,
                'cache_type': cache_type,
                'data': data,
                'cached_at': cached_at
            }
            
            batch_collection.update_one(
                {'user_id': user_id, 'cache_type': cache_type},
                {'$set': batch_doc},
                upsert=True
            )
            
            print(f"[news cache] Cached batch data for user {user_id}, type: {cache_type}")
        except Exception as e:
            print(f"Error setting news cache batch: {e}")

    def get_unified_news_cache(self, user_id):
        """Get unified news cache (all tickers + all story types)"""
        try:
            if self.client is None:
                return None
            
            # Check index first
            index = self.get_news_cache_index(user_id, 'unified')
            if not index:
                return None
            
            batch_collection = self.db.news_cache_batch
            batch_doc = batch_collection.find_one({
                'user_id': user_id,
                'cache_type': 'unified'
            })
            
            if batch_doc:
                return batch_doc.get('data', {})
            
            return None
        except Exception as e:
            print(f"Error getting unified news cache: {e}")
            return None

    def set_unified_news_cache(self, user_id, data, metadata=None):
        """Cache unified news data (all tickers + all story types)"""
        try:
            if self.client is None:
                return
            
            from datetime import timedelta
            cached_at = datetime.utcnow()
            
            # Update index
            index_collection = self.db.news_cache_index
            index_doc = {
                'user_id': user_id,
                'cache_type': 'unified',
                'cached_at': cached_at,
                'metadata': metadata or {}
            }
            
            index_collection.update_one(
                {'user_id': user_id, 'cache_type': 'unified'},
                {'$set': index_doc},
                upsert=True
            )
            
            # Update batch data
            batch_collection = self.db.news_cache_batch
            batch_doc = {
                'user_id': user_id,
                'cache_type': 'unified',
                'data': data,
                'cached_at': cached_at
            }
            
            batch_collection.update_one(
                {'user_id': user_id, 'cache_type': 'unified'},
                {'$set': batch_doc},
                upsert=True
            )
            
            print(f"[news cache] Cached unified news data for user {user_id}")
        except Exception as e:
            print(f"Error setting unified news cache: {e}")

    def clear_expired_news_cache(self):
        """Clear expired news cache entries (older than 1 minute)"""
        try:
            if self.client is None:
                return
            
            from datetime import timedelta
            cutoff_time = datetime.utcnow() - timedelta(minutes=1)
            
            # Clear expired index entries
            index_collection = self.db.news_cache_index
            expired_indices = index_collection.find({
                'cached_at': {'$lt': cutoff_time}
            })
            
            expired_user_types = []
            for index_doc in expired_indices:
                expired_user_types.append({
                    'user_id': index_doc['user_id'],
                    'cache_type': index_doc['cache_type']
                })
            
            # Delete expired indices
            index_collection.delete_many({
                'cached_at': {'$lt': cutoff_time}
            })
            
            # Delete corresponding batch data
            if expired_user_types:
                batch_collection = self.db.news_cache_batch
                for user_type in expired_user_types:
                    batch_collection.delete_one({
                        'user_id': user_type['user_id'],
                        'cache_type': user_type['cache_type']
                    })
            
            print(f"[news cache] Cleared {len(expired_user_types)} expired cache entries")
        except Exception as e:
            print(f"Error clearing expired news cache: {e}")

    # Trades collection methods
    def _format_trade_doc(self, trade):
        """Normalize trade document for API responses"""
        doc = trade.copy()
        raw_id = doc.get('_id') or doc.get('id')
        if isinstance(raw_id, ObjectId):
            raw_id = str(raw_id)
        if raw_id is not None:
            doc['_id'] = str(raw_id)
            doc['id'] = str(raw_id)
        if isinstance(doc.get('created_at'), datetime):
            doc['created_at'] = doc['created_at'].isoformat()
        if isinstance(doc.get('updated_at'), datetime):
            doc['updated_at'] = doc['updated_at'].isoformat()
        if isinstance(doc.get('date'), datetime):
            doc['date'] = doc['date'].isoformat()
        if isinstance(doc.get('trade_date'), datetime):
            doc['trade_date'] = doc['trade_date'].isoformat()
        return doc

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
                        user_trades.append(self._format_trade_doc(trade))
                
                return user_trades
            
            # Use MongoDB trades collection
            trades_collection = self.db.trades
            
            trades = list(trades_collection.find({'user_id': user_id}).sort('created_at', -1))
            return [self._format_trade_doc(trade) for trade in trades]
            
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
                object_id = ObjectId(trade_id)
                trade_data['updated_at'] = datetime.utcnow()
                result = trades_collection.update_one(
                    {
                        '_id': object_id,
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

    def get_trade_by_id(self, user_id, trade_id):
        """Fetch a single trade document"""
        try:
            if self.client is None:
                if not hasattr(self, '_fallback_trades'):
                    self._fallback_trades = []
                for trade in self._fallback_trades:
                    if trade.get('_id') == trade_id and trade.get('user_id') == user_id:
                        return self._format_trade_doc(trade)
                return None

            trades_collection = self.db.trades
            try:
                trade = trades_collection.find_one({'_id': ObjectId(trade_id), 'user_id': user_id})
            except Exception:
                return None
            if trade:
                return self._format_trade_doc(trade)
            return None
        except Exception as e:
            print(f"Error fetching trade: {e}")
            return None

    # Saved query collection methods
    def _format_query_doc(self, doc):
        formatted = doc.copy()
        formatted['id'] = str(formatted.pop('_id', formatted.get('_id')))
        if isinstance(formatted.get('created_at'), datetime):
            formatted['created_at'] = formatted['created_at'].isoformat()
        if isinstance(formatted.get('updated_at'), datetime):
            formatted['updated_at'] = formatted['updated_at'].isoformat()
        return formatted

    def save_user_query(self, user_id, query_data):
        """Save a screener/filter configuration for a user"""
        try:
            doc = {
                'user_id': user_id,
                'name': query_data.get('name'),
                'description': query_data.get('description', ''),
                'filters': query_data.get('filters', {}),
                'is_favorite': bool(query_data.get('is_favorite')),
                'owner_name': query_data.get('owner_name'),
                'owner_email': query_data.get('owner_email'),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }

            if self.client is None:
                if not hasattr(self, '_fallback_queries'):
                    self._fallback_queries = []
                self._fallback_counter += 1
                doc['_id'] = str(self._fallback_counter)
                self._fallback_queries.append(doc)
                return str(doc['_id'])

            collection = self.db.user_queries
            result = collection.insert_one(doc)
            return str(result.inserted_id)
        except Exception as e:
            print(f"Error saving user query: {e}")
            return None

    def get_user_queries(self, user_id):
        """Get saved queries for a user"""
        try:
            if self.client is None:
                if not hasattr(self, '_fallback_queries'):
                    self._fallback_queries = []
                user_queries = [
                    self._format_query_doc(q)
                    for q in self._fallback_queries
                    if q.get('user_id') == user_id
                ]
                user_queries.sort(key=lambda q: q['created_at'], reverse=True)
                return user_queries

            collection = self.db.user_queries
            queries = list(collection.find({'user_id': user_id}).sort('created_at', -1))
            return [self._format_query_doc(q) for q in queries]
        except Exception as e:
            print(f"Error loading user queries: {e}")
            return []

    def get_user_query(self, user_id, query_id):
        """Get a specific saved query"""
        try:
            if self.client is None:
                if not hasattr(self, '_fallback_queries'):
                    self._fallback_queries = []
                for query in self._fallback_queries:
                    if query.get('_id') == query_id and query.get('user_id') == user_id:
                        return self._format_query_doc(query)
                return None

            collection = self.db.user_queries
            try:
                object_id = ObjectId(query_id)
            except Exception:
                return None
            query = collection.find_one({'_id': object_id, 'user_id': user_id})
            if query:
                return self._format_query_doc(query)
            return None
        except Exception as e:
            print(f"Error getting user query: {e}")
            return None

    def delete_user_query(self, user_id, query_id):
        """Delete a saved query"""
        try:
            if self.client is None:
                if not hasattr(self, '_fallback_queries'):
                    self._fallback_queries = []
                for i, query in enumerate(self._fallback_queries):
                    if query.get('_id') == query_id and query.get('user_id') == user_id:
                        del self._fallback_queries[i]
                        return True
                return False

            collection = self.db.user_queries
            try:
                object_id = ObjectId(query_id)
            except Exception:
                return False
            result = collection.delete_one({'_id': object_id, 'user_id': user_id})
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error deleting user query: {e}")
            return False

    def update_user_query(self, user_id, query_id, updates):
        """Update fields on a saved query"""
        try:
            updates = {k: v for k, v in updates.items() if k in {'name', 'description', 'filters', 'is_favorite'}}
            if not updates:
                return False

            if self.client is None:
                if not hasattr(self, '_fallback_queries'):
                    self._fallback_queries = []
                for query in self._fallback_queries:
                    if query.get('_id') == query_id and query.get('user_id') == user_id:
                        query.update(updates)
                        query['updated_at'] = datetime.utcnow()
                        return True
                return False

            collection = self.db.user_queries
            try:
                object_id = ObjectId(query_id)
            except Exception:
                return False
            updates['updated_at'] = datetime.utcnow()
            result = collection.update_one(
                {'_id': object_id, 'user_id': user_id},
                {'$set': updates}
            )
            return result.modified_count > 0
        except Exception as e:
            print(f"Error updating user query: {e}")
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

    # User profile collection methods
    def get_or_create_user(self, user_id, email, name, picture):
        """Get user profile or create if doesn't exist (tracks first login)"""
        try:
            if self.client is None:
                # Use fallback storage
                if not hasattr(self, '_fallback_users'):
                    self._fallback_users = []
                
                # Find existing user
                for user in self._fallback_users:
                    if user.get('user_id') == user_id:
                        return user
                
                # Create new user
                user_doc = {
                    'user_id': user_id,
                    'email': email,
                    'name': name,
                    'picture': picture,
                    'first_login_date': datetime.utcnow(),
                    'created_at': datetime.utcnow(),
                    'updated_at': datetime.utcnow()
                }
                self._fallback_users.append(user_doc)
                return user_doc
            
            # Use MongoDB users collection
            users_collection = self.db.users
            
            # Try to find existing user
            user = users_collection.find_one({'user_id': user_id})
            
            if user:
                # User exists, return it
                return user
            
            # Create new user with first login date
            user_doc = {
                'user_id': user_id,
                'email': email,
                'name': name,
                'picture': picture,
                'first_login_date': datetime.utcnow(),
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            }
            users_collection.insert_one(user_doc)
            return user_doc
            
        except Exception as e:
            print(f"Error getting/creating user: {e}")
            return None

    def get_user_profile(self, user_id):
        """Get user profile"""
        try:
            if self.client is None:
                if not hasattr(self, '_fallback_users'):
                    self._fallback_users = []
                for user in self._fallback_users:
                    if user.get('user_id') == user_id:
                        return self._format_user_doc(user)
                return None
            
            users_collection = self.db.users
            user = users_collection.find_one({'user_id': user_id})
            if user:
                return self._format_user_doc(user)
            return None
            
        except Exception as e:
            print(f"Error getting user profile: {e}")
            return None

    def update_user_profile(self, user_id, profile_data):
        """Update user profile (name, picture, etc.)"""
        try:
            if self.client is None:
                if not hasattr(self, '_fallback_users'):
                    self._fallback_users = []
                for user in self._fallback_users:
                    if user.get('user_id') == user_id:
                        user.update(profile_data)
                        user['updated_at'] = datetime.utcnow()
                        return True
                return False
            
            users_collection = self.db.users
            profile_data['updated_at'] = datetime.utcnow()
            result = users_collection.update_one(
                {'user_id': user_id},
                {'$set': profile_data}
            )
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error updating user profile: {e}")
            return False

    def _format_user_doc(self, user):
        """Format user document for API responses"""
        doc = user.copy()
        # Convert ObjectId to string
        if '_id' in doc:
            if isinstance(doc['_id'], ObjectId):
                doc['_id'] = str(doc['_id'])
        if isinstance(doc.get('first_login_date'), datetime):
            doc['first_login_date'] = doc['first_login_date'].isoformat()
        if isinstance(doc.get('created_at'), datetime):
            doc['created_at'] = doc['created_at'].isoformat()
        if isinstance(doc.get('updated_at'), datetime):
            doc['updated_at'] = doc['updated_at'].isoformat()
        return doc

    def delete_all_user_data(self, user_id):
        """Delete all user data from all collections"""
        try:
            deleted_counts = {
                'trades': 0,
                'watchlist': 0,
                'user_queries': 0,
                'screeners': 0,
                'users': 0
            }
            
            if self.client is None:
                # Fallback storage
                # Delete trades
                if hasattr(self, '_fallback_trades'):
                    original_count = len(self._fallback_trades)
                    self._fallback_trades = [t for t in self._fallback_trades if t.get('user_id') != user_id]
                    deleted_counts['trades'] = original_count - len(self._fallback_trades)
                
                # Delete watchlist
                if hasattr(self, '_fallback_watchlist'):
                    original_count = len(self._fallback_watchlist)
                    self._fallback_watchlist = [w for w in self._fallback_watchlist if w.get('user_id') != user_id]
                    deleted_counts['watchlist'] = original_count - len(self._fallback_watchlist)
                
                # Delete queries
                if hasattr(self, '_fallback_queries'):
                    original_count = len(self._fallback_queries)
                    self._fallback_queries = [q for q in self._fallback_queries if q.get('user_id') != user_id]
                    deleted_counts['user_queries'] = original_count - len(self._fallback_queries)
                
                # Delete screeners
                if hasattr(self, '_fallback_storage'):
                    original_count = len(self._fallback_storage)
                    self._fallback_storage = [s for s in self._fallback_storage if s.get('user_id') != user_id]
                    deleted_counts['screeners'] = original_count - len(self._fallback_storage)
                
                # Delete user
                if hasattr(self, '_fallback_users'):
                    original_count = len(self._fallback_users)
                    self._fallback_users = [u for u in self._fallback_users if u.get('user_id') != user_id]
                    deleted_counts['users'] = original_count - len(self._fallback_users)
                
                return deleted_counts
            
            # MongoDB collections
            # Delete trades
            trades_collection = self.db.trades
            result = trades_collection.delete_many({'user_id': user_id})
            deleted_counts['trades'] = result.deleted_count
            
            # Delete watchlist
            watchlist_collection = self.db.watchlist
            result = watchlist_collection.delete_many({'user_id': user_id})
            deleted_counts['watchlist'] = result.deleted_count
            
            # Delete queries
            queries_collection = self.db.user_queries
            result = queries_collection.delete_many({'user_id': user_id})
            deleted_counts['user_queries'] = result.deleted_count
            
            # Delete screeners
            screeners_collection = self.db.screeners
            result = screeners_collection.delete_many({'user_id': user_id})
            deleted_counts['screeners'] = result.deleted_count
            
            # Delete user profile
            users_collection = self.db.users
            result = users_collection.delete_many({'user_id': user_id})
            deleted_counts['users'] = result.deleted_count
            
            return deleted_counts
            
        except Exception as e:
            print(f"Error deleting user data: {e}")
            return None

    def get_user_stats(self, user_id):
        """Get user activity statistics"""
        try:
            stats = {
                'saved_queries': 0,
                'watchlist_items': 0,
                'journal_entries': 0
            }
            
            if self.client is None:
                # Fallback storage
                if hasattr(self, '_fallback_queries'):
                    stats['saved_queries'] = len([q for q in self._fallback_queries if q.get('user_id') == user_id])
                if hasattr(self, '_fallback_watchlist'):
                    stats['watchlist_items'] = len([w for w in self._fallback_watchlist if w.get('user_id') == user_id])
                if hasattr(self, '_fallback_trades'):
                    stats['journal_entries'] = len([t for t in self._fallback_trades if t.get('user_id') == user_id])
                return stats
            
            # MongoDB collections
            queries_collection = self.db.user_queries
            stats['saved_queries'] = queries_collection.count_documents({'user_id': user_id})
            
            watchlist_collection = self.db.watchlist
            stats['watchlist_items'] = watchlist_collection.count_documents({'user_id': user_id})
            
            trades_collection = self.db.trades
            stats['journal_entries'] = trades_collection.count_documents({'user_id': user_id})
            
            return stats
            
        except Exception as e:
            print(f"Error getting user stats: {e}")
            return {'saved_queries': 0, 'watchlist_items': 0, 'journal_entries': 0}

    # Price Alerts Methods
    def save_price_alert(self, user_id, alert_data):
        """Save a new price alert"""
        try:
            if self.client is None:
                return None
            
            alerts_collection = self.db.price_alerts
            alert_doc = {
                'user_id': user_id,
                'symbol': alert_data.get('symbol', '').upper().strip(),
                'alert_type': alert_data.get('alert_type', 'price'),  # price, percentage, volume, technical
                'condition': alert_data.get('condition', 'above'),  # above, below, equals
                'threshold': alert_data.get('threshold', 0),
                'percentage_change': alert_data.get('percentage_change'),
                'is_active': alert_data.get('is_active', True),
                'created_at': datetime.utcnow(),
                'last_triggered': None,
                'trigger_count': 0,
                'notification_method': alert_data.get('notification_method', 'in_app'),  # in_app, email
                'notes': alert_data.get('notes', '')
            }
            
            result = alerts_collection.insert_one(alert_doc)
            return str(result.inserted_id)
            
        except Exception as e:
            print(f"Error saving price alert: {e}")
            return None

    def get_user_alerts(self, user_id, active_only=False):
        """Get all alerts for a user"""
        try:
            if self.client is None:
                return []
            
            alerts_collection = self.db.price_alerts
            query = {'user_id': user_id}
            if active_only:
                query['is_active'] = True
            
            alerts = list(alerts_collection.find(query).sort('created_at', -1))
            
            # Convert ObjectId to string
            for alert in alerts:
                alert['_id'] = str(alert['_id'])
                if alert.get('created_at'):
                    alert['created_at'] = alert['created_at'].isoformat()
                if alert.get('last_triggered'):
                    alert['last_triggered'] = alert['last_triggered'].isoformat()
            
            return alerts
            
        except Exception as e:
            print(f"Error getting user alerts: {e}")
            return []

    def get_alert(self, user_id, alert_id):
        """Get a specific alert by ID"""
        try:
            if self.client is None:
                return None
            
            alerts_collection = self.db.price_alerts
            alert = alerts_collection.find_one({
                '_id': ObjectId(alert_id),
                'user_id': user_id
            })
            
            if alert:
                alert['_id'] = str(alert['_id'])
                if alert.get('created_at'):
                    alert['created_at'] = alert['created_at'].isoformat()
                if alert.get('last_triggered'):
                    alert['last_triggered'] = alert['last_triggered'].isoformat()
            
            return alert
            
        except Exception as e:
            print(f"Error getting alert: {e}")
            return None

    def update_price_alert(self, user_id, alert_id, update_data):
        """Update an existing price alert"""
        try:
            if self.client is None:
                return False
            
            alerts_collection = self.db.price_alerts
            
            # Prepare update document
            update_doc = {}
            if 'symbol' in update_data:
                update_doc['symbol'] = update_data['symbol'].upper().strip()
            if 'alert_type' in update_data:
                update_doc['alert_type'] = update_data['alert_type']
            if 'condition' in update_data:
                update_doc['condition'] = update_data['condition']
            if 'threshold' in update_data:
                update_doc['threshold'] = update_data['threshold']
            if 'percentage_change' in update_data:
                update_doc['percentage_change'] = update_data['percentage_change']
            if 'is_active' in update_data:
                update_doc['is_active'] = update_data['is_active']
            if 'notification_method' in update_data:
                update_doc['notification_method'] = update_data['notification_method']
            if 'notes' in update_data:
                update_doc['notes'] = update_data['notes']
            
            if not update_doc:
                return False
            
            result = alerts_collection.update_one(
                {'_id': ObjectId(alert_id), 'user_id': user_id},
                {'$set': update_doc}
            )
            
            return result.matched_count > 0
            
        except Exception as e:
            print(f"Error updating price alert: {e}")
            return False

    def delete_price_alert(self, user_id, alert_id):
        """Delete a price alert"""
        try:
            if self.client is None:
                return False
            
            alerts_collection = self.db.price_alerts
            result = alerts_collection.delete_one({
                '_id': ObjectId(alert_id),
                'user_id': user_id
            })
            
            return result.deleted_count > 0
            
        except Exception as e:
            print(f"Error deleting price alert: {e}")
            return False

    def get_active_alerts_for_symbols(self, symbols):
        """Get all active alerts for a list of symbols (for checking)"""
        try:
            if self.client is None:
                return []
            
            alerts_collection = self.db.price_alerts
            alerts = list(alerts_collection.find({
                'symbol': {'$in': [s.upper().strip() for s in symbols]},
                'is_active': True
            }))
            
            # Convert ObjectId to string
            for alert in alerts:
                alert['_id'] = str(alert['_id'])
                alert['user_id'] = str(alert['user_id'])
            
            return alerts
            
        except Exception as e:
            print(f"Error getting active alerts for symbols: {e}")
            return []

    def mark_alert_triggered(self, alert_id, current_price, current_change_percent=None):
        """Mark an alert as triggered and update trigger count"""
        try:
            if self.client is None:
                return False
            
            alerts_collection = self.db.price_alerts
            result = alerts_collection.update_one(
                {'_id': ObjectId(alert_id)},
                {
                    '$set': {
                        'last_triggered': datetime.utcnow(),
                        'triggered_price': current_price,
                        'triggered_change_percent': current_change_percent
                    },
                    '$inc': {'trigger_count': 1}
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            print(f"Error marking alert as triggered: {e}")
            return False

# Global MongoDB manager instance
mongodb_manager = MongoDBManager() 