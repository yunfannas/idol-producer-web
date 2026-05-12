"""
Publisher data structure for Idol Producer game.

Represents a publishing company or label.
"""

from dataclasses import dataclass, field
from typing import Optional
import uuid


@dataclass
class Publisher:
    """
    Represents a publisher or record label.
    
    Publishers release music, books, magazines, and other media.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    name: str = ""                          # Publisher name
    name_romanji: str = ""                  # Romanized name
    description: str = ""                   # Publisher description
    founded_date: Optional[str] = None       # Date when publisher was founded
    website: Optional[str] = None           # Publisher website URL
    logo_path: Optional[str] = None          # Path to logo image
    
    def to_dict(self) -> dict:
        """Convert publisher to dictionary."""
        return {
            'uid': self.uid,
            'name': self.name,
            'name_romanji': self.name_romanji,
            'description': self.description,
            'founded_date': self.founded_date,
            'website': self.website,
            'logo_path': self.logo_path
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'Publisher':
        """Create Publisher from dictionary."""
        return cls(
            uid=data.get('uid', str(uuid.uuid4())),
            name=data.get('name', ''),
            name_romanji=data.get('name_romanji', ''),
            description=data.get('description', ''),
            founded_date=data.get('founded_date'),
            website=data.get('website'),
            logo_path=data.get('logo_path')
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"Publisher(name='{self.name}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return f"Publisher(name='{self.name}', founded_date={self.founded_date})"

