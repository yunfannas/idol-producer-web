"""
Live performance data structure for Idol Producer game.

Represents a live performance, concert, or event.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional, Union
import uuid


def _normalize_group_field(group_data: Union[str, List[str], None]) -> List[str]:
    """Normalize group field to always be a list.
    
    Handles backward compatibility with old format where group was a string.
    """
    if group_data is None:
        return []
    if isinstance(group_data, str):
        return [group_data] if group_data else []
    if isinstance(group_data, list):
        return [g for g in group_data if g]  # Filter out empty strings
    return []


@dataclass
class Live:
    """
    Represents a live performance, concert, or event.
    
    Live performances can be concerts, fan meetings, festivals, etc.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    title: str = ""                          # Live event title
    title_romanji: str = ""                  # Romanized title
    event_type: str = ""                      # Type: "Concert", "Fan Meeting", "Festival", "Tour", etc.
    start_date: Optional[date] = None         # Start date (first performance)
    end_date: Optional[date] = None          # End date (last performance, None if single event)
    venue: Optional[str] = None               # Venue name
    venue_uid: Optional[str] = None           # Venue UID
    location: str = ""                       # Location (city, country)
    description: str = ""                     # Event description
    group: List[str] = field(default_factory=list)  # List of group names that performed at this live
    performance_count: Optional[int] = None   # Number of performances (for tours)
    duration: Optional[int] = None            # Duration per performance in minutes
    ticket_price: Optional[int] = None        # Ticket price in JPY
    capacity: Optional[int] = None            # Venue capacity
    attendance: Optional[int] = None           # Actual attendance
    poster_image_path: Optional[str] = None   # Path to poster image
    setlist: List[str] = field(default_factory=list)  # List of songs performed
    
    def to_dict(self) -> dict:
        """Convert live event to dictionary."""
        return {
            'uid': self.uid,
            'title': self.title,
            'title_romanji': self.title_romanji,
            'event_type': self.event_type,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'venue': self.venue,
            'venue_uid': self.venue_uid,
            'location': self.location,
            'description': self.description,
            'performance_count': self.performance_count,
            'duration': self.duration,
            'ticket_price': self.ticket_price,
            'capacity': self.capacity,
            'attendance': self.attendance,
            'poster_image_path': self.poster_image_path,
            'setlist': self.setlist,
            'group': self.group if self.group else []
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'Live':
        """Create Live from dictionary."""
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
            event_type=data.get('event_type', ''),
            start_date=start_date,
            end_date=end_date,
            venue=data.get('venue'),
            venue_uid=data.get('venue_uid'),
            location=data.get('location', ''),
            description=data.get('description', ''),
            performance_count=data.get('performance_count'),
            duration=data.get('duration'),
            ticket_price=data.get('ticket_price'),
            capacity=data.get('capacity'),
            attendance=data.get('attendance'),
            poster_image_path=data.get('poster_image_path'),
            setlist=data.get('setlist', []),
            group=_normalize_group_field(data.get('group'))
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"Live(title='{self.title}', type='{self.event_type}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return (f"Live(title='{self.title}', "
                f"event_type='{self.event_type}', "
                f"start_date={self.start_date}, "
                f"end_date={self.end_date}, "
                f"venue='{self.venue}')")

