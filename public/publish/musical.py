"""
Musical data structure for Idol Producer game.

Represents a musical or stage production.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional
import uuid


@dataclass
class Musical:
    """
    Represents a musical or stage production.
    
    Musicals are live stage performances.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    title: str = ""                          # Musical title
    title_romanji: str = ""                  # Romanized title
    start_date: Optional[date] = None        # Start date (first performance)
    end_date: Optional[date] = None          # End date (last performance, None if ongoing)
    venue: str = ""                          # Venue name
    location: str = ""                       # Location (city, country)
    description: str = ""                    # Musical description
    performance_count: Optional[int] = None   # Number of performances
    duration: Optional[int] = None            # Duration in minutes
    poster_image_path: Optional[str] = None   # Path to poster image
    
    def to_dict(self) -> dict:
        """Convert musical to dictionary."""
        return {
            'uid': self.uid,
            'title': self.title,
            'title_romanji': self.title_romanji,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'venue': self.venue,
            'location': self.location,
            'description': self.description,
            'performance_count': self.performance_count,
            'duration': self.duration,
            'poster_image_path': self.poster_image_path
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'Musical':
        """Create Musical from dictionary."""
        start_date = None
        start_date_str = data.get('start_date')
        if start_date_str:
            if isinstance(start_date_str, str):
                start_date_str = start_date_str.split('T')[0]
                start_date = date.fromisoformat(start_date_str)
            elif isinstance(start_date_str, date):
                start_date = start_date_str
        
        end_date = None
        end_date_str = data.get('end_date')
        if end_date_str:
            if isinstance(end_date_str, str):
                end_date_str = end_date_str.split('T')[0]
                end_date = date.fromisoformat(end_date_str)
            elif isinstance(end_date_str, date):
                end_date = end_date_str
        
        return cls(
            uid=data.get('uid', str(uuid.uuid4())),
            title=data.get('title', ''),
            title_romanji=data.get('title_romanji', ''),
            start_date=start_date,
            end_date=end_date,
            venue=data.get('venue', ''),
            location=data.get('location', ''),
            description=data.get('description', ''),
            performance_count=data.get('performance_count'),
            duration=data.get('duration'),
            poster_image_path=data.get('poster_image_path')
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"Musical(title='{self.title}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return (f"Musical(title='{self.title}', "
                f"start_date={self.start_date}, "
                f"end_date={self.end_date}, "
                f"venue='{self.venue}')")

