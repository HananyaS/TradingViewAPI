import os
from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId

# MongoDB configuration
MONGODB_URL = os.getenv('MONGODB_URL')
MONGODB_DB = os.getenv('MONGODB_DB')

class MongoDBManager:
    def __init__(self):
        try:
            # For MongoDB Atlas, the URL should include username, password, and cluster info
            # Format: mongodb+srv://username:password@cluster.mongodb.net/database
            
            # Configure MongoDB client with SSL settings for Render deployment
            if MONGODB_URL.startswith('mongodb+srv://'):
                # For MongoDB Atlas, use specific SSL settings
                self.client = MongoClient(
                    MONGODB_URL,
                    ssl=True,
                    ssl_cert_reqs='CERT_NONE',  # Disable certificate verification for Render
                    serverSelectionTimeoutMS=5000,
                    connectTimeoutMS=10000,
                    socketTimeoutMS=10000,
                    maxPoolSize=1,
                    retryWrites=True,
                    retryReads=True
                )
            else:
                # For local MongoDB
                self.client = MongoClient(MONGODB_URL)
            
            # Test the connection
            self.client.admin.command('ping')
            print("MongoDB connection successful!")
            
            self.db = self.client[MONGODB_DB]
            self.screeners_collection = self.db.screeners
            
            # Create indexes for better performance
            self.screeners_collection.create_index([("name", 1)])
            self.screeners_collection.create_index([("owner", 1)])
            self.screeners_collection.create_index([("created_at", -1)])
            
        except Exception as e:
            print(f"MongoDB connection error: {e}")
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
    
    def save_screener(self, name, owner, tags, params):
        """Save a screener configuration"""
        screener_data = {
            'name': name,
            'owner': owner,
            'tags': tags,
            'params': params,
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
    
    def get_all_screeners(self):
        """Get all saved screeners"""
        if self.screeners_collection is not None:
            # Use MongoDB
            screeners = list(self.screeners_collection.find().sort('created_at', -1))
            # Convert ObjectId to string for JSON serialization
            for screener in screeners:
                screener['_id'] = str(screener['_id'])
                screener['created_at'] = screener['created_at'].isoformat()
                screener['updated_at'] = screener['updated_at'].isoformat()
            return screeners
        else:
            # Use fallback storage
            # First, ensure all dates are strings for consistent sorting
            screeners = [self._ensure_string_dates(screener) for screener in self._fallback_storage]
            
            # Sort by created_at (now all strings)
            screeners.sort(key=lambda x: x['created_at'], reverse=True)
            return screeners
    
    def get_screener_by_id(self, screener_id):
        """Get a specific screener by ID"""
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

# Global MongoDB manager instance
mongodb_manager = MongoDBManager() 