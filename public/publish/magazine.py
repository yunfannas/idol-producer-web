"""
Magazine data structure for Idol Producer game.

Represents a magazine publication or issue.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Optional
import uuid


@dataclass
class Magazine:
    """
    Represents a magazine publication or issue.
    
    Magazines can be regular issues or special editions.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    title: str = ""                          # Magazine title
    issue_number: str = ""                   # Issue number or identifier
    release_date: Optional[date] = None       # Release date
    publisher: Optional[str] = None           # Publisher name
    publisher_uid: Optional[str] = None       # Publisher UID
    description: str = ""                    # Magazine description
    page_count: Optional[int] = None          # Number of pages
    cover_image_path: Optional[str] = None    # Path to cover image
    
    def to_dict(self) -> dict:
        """Convert magazine to dictionary."""
        return {
            'uid': self.uid,
            'title': self.title,
            'issue_number': self.issue_number,
            'release_date': self.release_date.isoformat() if self.release_date else None,
            'publisher': self.publisher,
            'publisher_uid': self.publisher_uid,
            'description': self.description,
            'page_count': self.page_count,
            'cover_image_path': self.cover_image_path
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'Magazine':
        """Create Magazine from dictionary."""
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
            issue_number=data.get('issue_number', ''),
            release_date=release_date,
            publisher=data.get('publisher'),
            publisher_uid=data.get('publisher_uid'),
            description=data.get('description', ''),
            page_count=data.get('page_count'),
            cover_image_path=data.get('cover_image_path')
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"Magazine(title='{self.title}', issue='{self.issue_number}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return (f"Magazine(title='{self.title}', "
                f"issue_number='{self.issue_number}', "
                f"release_date={self.release_date})")

