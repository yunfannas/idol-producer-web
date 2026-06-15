"""
Book data structure for Idol Producer game.

Represents a book publication.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Optional
import uuid


@dataclass
class Book:
    """
    Represents a book publication.
    
    Books can be novels, photo books, autobiographies, etc.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    title: str = ""                          # Book title
    title_romanji: str = ""                  # Romanized title
    book_type: str = ""                      # Type: "Novel", "Photo Book", "Autobiography", etc.
    release_date: Optional[date] = None       # Release date
    publisher: Optional[str] = None           # Publisher name
    publisher_uid: Optional[str] = None       # Publisher UID
    isbn: str = ""                           # ISBN number
    page_count: Optional[int] = None          # Number of pages
    description: str = ""                     # Book description
    cover_image_path: Optional[str] = None    # Path to cover image
    
    def to_dict(self) -> dict:
        """Convert book to dictionary."""
        return {
            'uid': self.uid,
            'title': self.title,
            'title_romanji': self.title_romanji,
            'book_type': self.book_type,
            'release_date': self.release_date.isoformat() if self.release_date else None,
            'publisher': self.publisher,
            'publisher_uid': self.publisher_uid,
            'isbn': self.isbn,
            'page_count': self.page_count,
            'description': self.description,
            'cover_image_path': self.cover_image_path
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'Book':
        """Create Book from dictionary."""
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
            book_type=data.get('book_type', ''),
            release_date=release_date,
            publisher=data.get('publisher'),
            publisher_uid=data.get('publisher_uid'),
            isbn=data.get('isbn', ''),
            page_count=data.get('page_count'),
            description=data.get('description', ''),
            cover_image_path=data.get('cover_image_path')
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"Book(title='{self.title}', type='{self.book_type}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return (f"Book(title='{self.title}', "
                f"book_type='{self.book_type}', "
                f"release_date={self.release_date})")

