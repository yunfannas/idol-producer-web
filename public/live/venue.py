"""
Venue data structure for Idol Producer game.

Represents a venue where live performances take place.
"""

from dataclasses import dataclass, field
from typing import Optional
import uuid


@dataclass
class Venue:
    """
    Represents a venue where live performances take place.
    
    Venues can be concert halls, arenas, stadiums, theaters, etc.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    name: str = ""                          # Venue name
    name_romanji: str = ""                  # Romanized name
    venue_type: str = ""                     # Type: "Concert Hall", "Arena", "Stadium", "Theater", etc.
    location: str = ""                       # Location (city, country, address)
    capacity: Optional[int] = None          # Maximum capacity
    description: str = ""                    # Venue description
    website: Optional[str] = None            # Venue website URL
    opened_date: Optional[str] = None        # Date when venue opened
    image_path: Optional[str] = None         # Path to venue image
    
    def to_dict(self) -> dict:
        """Convert venue to dictionary."""
        return {
            'uid': self.uid,
            'name': self.name,
            'name_romanji': self.name_romanji,
            'venue_type': self.venue_type,
            'location': self.location,
            'capacity': self.capacity,
            'description': self.description,
            'website': self.website,
            'opened_date': self.opened_date,
            'image_path': self.image_path
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'Venue':
        """Create Venue from dictionary."""
        return cls(
            uid=data.get('uid', str(uuid.uuid4())),
            name=data.get('name', ''),
            name_romanji=data.get('name_romanji', ''),
            venue_type=data.get('venue_type', ''),
            location=data.get('location', ''),
            capacity=data.get('capacity'),
            description=data.get('description', ''),
            website=data.get('website'),
            opened_date=data.get('opened_date'),
            image_path=data.get('image_path')
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"Venue(name='{self.name}', type='{self.venue_type}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return (f"Venue(name='{self.name}', "
                f"venue_type='{self.venue_type}', "
                f"location='{self.location}', "
                f"capacity={self.capacity})")

