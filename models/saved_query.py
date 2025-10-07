"""
Saved Query Model for Query Persistence
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import json

Base = declarative_base()

class SavedQuery(Base):
    """Model for storing user's saved screening queries"""
    __tablename__ = 'saved_queries'
    
    id = Column(Integer, primary_key=True)
    user_id = Column(String(255), nullable=False, index=True)  # From existing auth system
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    filters_json = Column(Text, nullable=False)  # JSON string of filter structure
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_favorite = Column(Boolean, default=False)
    
    def to_dict(self):
        """Convert to dictionary for JSON response"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'description': self.description,
            'filters': json.loads(self.filters_json) if self.filters_json else {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_favorite': self.is_favorite
        }
    
    @classmethod
    def from_dict(cls, data, user_id):
        """Create from dictionary"""
        return cls(
            user_id=user_id,
            name=data.get('name'),
            description=data.get('description'),
            filters_json=json.dumps(data.get('filters', {})),
            is_favorite=data.get('is_favorite', False)
        )

# TODO: Add this to your existing database initialization
# from sqlalchemy import create_engine
# engine = create_engine('your_database_url')
# Base.metadata.create_all(engine)
