"""
TV data structure for Idol Producer game.

Represents a TV show, drama, or variety program.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional
import uuid


@dataclass
class TV:
    """
    Represents a TV show, drama, or variety program.
    
    TV shows can be dramas, variety shows, documentaries, etc.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    title: str = ""                          # TV show title
    title_romanji: str = ""                  # Romanized title
    show_type: str = ""                      # Type: "Drama", "Variety", "Documentary", etc.
    start_date: Optional[date] = None        # Start date (first episode)
    end_date: Optional[date] = None          # End date (last episode, None if ongoing)
    network: str = ""                        # Broadcasting network
    description: str = ""                    # Show description
    episode_count: Optional[int] = None      # Number of episodes
    episode_duration: Optional[int] = None    # Duration per episode in minutes
    poster_image_path: Optional[str] = None   # Path to poster image
    
    def to_dict(self) -> dict:
        """Convert TV show to dictionary."""
        return {
            'uid': self.uid,
            'title': self.title,
            'title_romanji': self.title_romanji,
            'show_type': self.show_type,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'network': self.network,
            'description': self.description,
            'episode_count': self.episode_count,
            'episode_duration': self.episode_duration,
            'poster_image_path': self.poster_image_path
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'TV':
        """Create TV from dictionary."""
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
            show_type=data.get('show_type', ''),
            start_date=start_date,
            end_date=end_date,
            network=data.get('network', ''),
            description=data.get('description', ''),
            episode_count=data.get('episode_count'),
            episode_duration=data.get('episode_duration'),
            poster_image_path=data.get('poster_image_path')
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"TV(title='{self.title}', type='{self.show_type}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return (f"TV(title='{self.title}', "
                f"show_type='{self.show_type}', "
                f"start_date={self.start_date}, "
                f"end_date={self.end_date})")

