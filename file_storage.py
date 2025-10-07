import json
import os
from datetime import datetime
from pathlib import Path

class FileStorageManager:
    def __init__(self, storage_dir="data"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
        self.screeners_file = self.storage_dir / "screeners.json"
        self._load_screeners()
    
    def _load_screeners(self):
        """Load screeners from file"""
        if self.screeners_file.exists():
            try:
                with open(self.screeners_file, 'r') as f:
                    self.screeners = json.load(f)
            except Exception as e:
                print(f"Error loading screeners: {e}")
                self.screeners = []
        else:
            self.screeners = []
    
    def _save_screeners(self):
        """Save screeners to file"""
        try:
            with open(self.screeners_file, 'w') as f:
                json.dump(self.screeners, f, indent=2)
        except Exception as e:
            print(f"Error saving screeners: {e}")
    
    def save_screener(self, name, owner, tags, params, user_id=None, is_public=False):
        """Save a screener configuration"""
        screener_data = {
            'id': str(len(self.screeners) + 1),
            'name': name,
            'owner': owner,
            'tags': tags,
            'params': params,
            'user_id': user_id,
            'is_public': is_public,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }
        self.screeners.append(screener_data)
        self._save_screeners()
        return screener_data['id']
    
    def get_all_screeners(self, user_id=None, include_public=True):
        """Get all saved screeners with user filtering"""
        screeners = []
        for screener in self.screeners:
            # Apply filtering logic
            if user_id:
                if include_public:
                    if screener.get('user_id') == user_id or screener.get('is_public', False):
                        screeners.append(screener)
                else:
                    if screener.get('user_id') == user_id:
                        screeners.append(screener)
            elif include_public:
                # No user_id but include public screeners
                if screener.get('is_public', False):
                    screeners.append(screener)
        
        # Sort by created_at
        screeners.sort(key=lambda x: x['created_at'], reverse=True)
        return screeners
    
    def get_screener_by_id(self, screener_id):
        """Get a specific screener by ID"""
        for screener in self.screeners:
            if screener['id'] == screener_id:
                return screener
        return None
    
    def delete_screener(self, screener_id):
        """Delete a screener by ID"""
        for i, screener in enumerate(self.screeners):
            if screener['id'] == screener_id:
                del self.screeners[i]
                self._save_screeners()
                return True
        return False
    
    def search_screeners(self, search_term):
        """Search screeners by name, owner, or tags"""
        search_term_lower = search_term.lower()
        results = []
        
        for screener in self.screeners:
            if (search_term_lower in screener['name'].lower() or
                search_term_lower in screener['owner'].lower() or
                (screener['tags'] and search_term_lower in screener['tags'].lower())):
                results.append(screener)
        
        return results 