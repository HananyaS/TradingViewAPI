"""
Query Service for CRUD operations on saved queries
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from models.saved_query import SavedQuery
import json

class QueryService:
    """Service layer for managing saved queries"""
    
    def __init__(self, db_session):
        self.db = db_session
    
    def save_query(self, user_id: str, query_data: Dict[str, Any]) -> Dict[str, Any]:
        """Save a new query for the user"""
        try:
            # Validate required fields
            if not query_data.get('name'):
                raise ValueError("Query name is required")
            
            if not query_data.get('filters'):
                raise ValueError("Query filters are required")
            
            # Check if name already exists for this user
            existing = self.db.query(SavedQuery).filter_by(
                user_id=user_id, 
                name=query_data['name']
            ).first()
            
            if existing:
                raise ValueError(f"Query with name '{query_data['name']}' already exists")
            
            # Create new saved query
            saved_query = SavedQuery.from_dict(query_data, user_id)
            self.db.add(saved_query)
            self.db.commit()
            
            return {
                'success': True,
                'message': 'Query saved successfully',
                'query': saved_query.to_dict()
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                'success': False,
                'message': str(e)
            }
    
    def get_user_queries(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all saved queries for a user"""
        try:
            queries = self.db.query(SavedQuery).filter_by(
                user_id=user_id
            ).order_by(SavedQuery.updated_at.desc()).all()
            
            return [query.to_dict() for query in queries]
            
        except Exception as e:
            print(f"Error fetching user queries: {e}")
            return []
    
    def get_query_by_id(self, user_id: str, query_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific query by ID (only if it belongs to the user)"""
        try:
            query = self.db.query(SavedQuery).filter_by(
                id=query_id,
                user_id=user_id
            ).first()
            
            return query.to_dict() if query else None
            
        except Exception as e:
            print(f"Error fetching query {query_id}: {e}")
            return None
    
    def update_query(self, user_id: str, query_id: int, query_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing query"""
        try:
            query = self.db.query(SavedQuery).filter_by(
                id=query_id,
                user_id=user_id
            ).first()
            
            if not query:
                return {
                    'success': False,
                    'message': 'Query not found'
                }
            
            # Update fields
            if 'name' in query_data:
                query.name = query_data['name']
            if 'description' in query_data:
                query.description = query_data['description']
            if 'filters' in query_data:
                query.filters_json = json.dumps(query_data['filters'])
            if 'is_favorite' in query_data:
                query.is_favorite = query_data['is_favorite']
            
            query.updated_at = datetime.utcnow()
            self.db.commit()
            
            return {
                'success': True,
                'message': 'Query updated successfully',
                'query': query.to_dict()
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                'success': False,
                'message': str(e)
            }
    
    def delete_query(self, user_id: str, query_id: int) -> Dict[str, Any]:
        """Delete a query"""
        try:
            query = self.db.query(SavedQuery).filter_by(
                id=query_id,
                user_id=user_id
            ).first()
            
            if not query:
                return {
                    'success': False,
                    'message': 'Query not found'
                }
            
            self.db.delete(query)
            self.db.commit()
            
            return {
                'success': True,
                'message': 'Query deleted successfully'
            }
            
        except Exception as e:
            self.db.rollback()
            return {
                'success': False,
                'message': str(e)
            }
    
    def get_favorite_queries(self, user_id: str) -> List[Dict[str, Any]]:
        """Get user's favorite queries"""
        try:
            queries = self.db.query(SavedQuery).filter_by(
                user_id=user_id,
                is_favorite=True
            ).order_by(SavedQuery.updated_at.desc()).all()
            
            return [query.to_dict() for query in queries]
            
        except Exception as e:
            print(f"Error fetching favorite queries: {e}")
            return []
