"""
Disc data structure for Idol Producer game.

Represents a disc (CD, DVD, Blu-ray, etc.) release.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import List, Optional
import uuid


@dataclass
class Disc:
    """
    Represents a disc release (CD, DVD, Blu-ray, etc.).
    
    Discs can contain music, videos, or other content.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    title: str = ""                          # Disc title
    title_romanji: str = ""                  # Romanized title
    disc_type: str = ""                      # Type: "CD", "DVD", "Blu-ray", etc.
    release_date: Optional[date] = None       # Release date
    publisher: Optional[str] = None           # Publisher name
    publisher_uid: Optional[str] = None       # Publisher UID
    catalog_number: str = ""                  # Catalog number
    description: str = ""                     # Disc description
    track_list: List[str] = field(default_factory=list)  # List of track titles
    track_song_uids: List[str] = field(default_factory=list)  # Song UIDs in track order
    duration: Optional[int] = None            # Total duration in seconds
    cover_image_path: Optional[str] = None    # Path to cover image
    
    def to_dict(self) -> dict:
        """Convert disc to dictionary."""
        return {
            'uid': self.uid,
            'title': self.title,
            'title_romanji': self.title_romanji,
            'disc_type': self.disc_type,
            'release_date': self.release_date.isoformat() if self.release_date else None,
            'publisher': self.publisher,
            'publisher_uid': self.publisher_uid,
            'catalog_number': self.catalog_number,
            'description': self.description,
            'track_list': self.track_list,
            'track_song_uids': self.track_song_uids,
            'duration': self.duration,
            'cover_image_path': self.cover_image_path
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'Disc':
        """Create Disc from dictionary."""
        release_date = None
        release_date_str = data.get('release_date')
        if release_date_str:
            if isinstance(release_date_str, str):
                release_date_str = release_date_str.split('T')[0]
                release_date = date.fromisoformat(release_date_str)
            elif isinstance(release_date_str, date):
                release_date = release_date_str
        
        return cls(
            uid=data.get('uid', str(uuid.uuid4())),
            title=data.get('title', ''),
            title_romanji=data.get('title_romanji', ''),
            disc_type=data.get('disc_type', ''),
            release_date=release_date,
            publisher=data.get('publisher'),
            publisher_uid=data.get('publisher_uid'),
            catalog_number=data.get('catalog_number', ''),
            description=data.get('description', ''),
            track_list=data.get('track_list', []),
            track_song_uids=data.get('track_song_uids', []),
            duration=data.get('duration'),
            cover_image_path=data.get('cover_image_path')
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"Disc(title='{self.title}', type='{self.disc_type}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return (f"Disc(title='{self.title}', "
                f"disc_type='{self.disc_type}', "
                f"release_date={self.release_date})")

