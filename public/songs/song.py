"""
Song data structure for Idol Producer game.

Represents a song released by an idol group.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Optional
import uuid


@dataclass
class Song:
    """
    Represents a song.
    
    Songs are associated with groups and can have release dates, genres, etc.
    """
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))  # Unique identifier
    group_uid: Optional[str] = None           # Owning group UID
    group_name: str = ""                      # Owning group display name
    title: str = ""                          # Song title
    title_romanji: str = ""                  # Romanized title
    release_date: Optional[date] = None       # Release date
    genre: str = ""                          # Genre (e.g., "J-Pop", "Rock", "Ballad")
    duration: Optional[int] = None            # Duration in seconds
    lyrics: str = ""                         # Lyrics (optional)
    composer: str = ""                       # Composer name
    lyricist: str = ""                       # Lyricist name
    arrangement: str = ""                    # Arranger name
    description: str = ""                    # Song description
    spotify_url: Optional[str] = None        # Spotify URL
    youtube_url: Optional[str] = None        # YouTube URL
    albums: list[dict] = field(default_factory=list)  # Release refs: [{disc_uid, name, track_number}]
    version: str = ""                        # Version marker like "2019 ver." or "LIVE ver."
    disc_uid: Optional[str] = None           # Source release UID
    popularity: Optional[float] = None       # Simple song popularity scale, typically 0-5
    signature_song: bool = False             # Representative song flag
    popularity_local: Optional[float] = None # Group-internal relative popularity
    popularity_global: Optional[float] = None  # Cross-group visibility estimate
    source_confidence: str = ""              # Provenance marker like "manual" or "estimated"
    notes: str = ""                          # Short curation notes
    hidden: bool = False                     # Exclude from normal game/UI song pools
    
    def to_dict(self) -> dict:
        """Convert song to dictionary."""
        album_payloads = []
        if isinstance(self.albums, list):
            for album in self.albums:
                if not isinstance(album, dict):
                    continue
                album_payloads.append(
                    {
                        'disc_uid': album.get('disc_uid'),
                        'name': album.get('name', ''),
                        'track_number': album.get('track_number'),
                    }
                )
        return {
            'uid': self.uid,
            'group_uid': self.group_uid,
            'group_name': self.group_name,
            'title': self.title,
            'title_romanji': self.title_romanji,
            'release_date': self.release_date.isoformat() if self.release_date else None,
            'genre': self.genre,
            'duration': self.duration,
            'lyrics': self.lyrics,
            'composer': self.composer,
            'lyricist': self.lyricist,
            'arrangement': self.arrangement,
            'description': self.description,
            'spotify_url': self.spotify_url,
            'youtube_url': self.youtube_url,
            'albums': album_payloads,
            'version': self.version,
            'disc_uid': self.disc_uid,
            'popularity': self.popularity,
            'signature_song': self.signature_song,
            'popularity_local': self.popularity_local,
            'popularity_global': self.popularity_global,
            'source_confidence': self.source_confidence,
            'notes': self.notes,
            'hidden': self.hidden,
        }
    
    @classmethod
    def create_from_dict(cls, data: dict) -> 'Song':
        """Create Song from dictionary."""
        release_date = None
        release_date_str = data.get('release_date')
        if release_date_str:
            if isinstance(release_date_str, str):
                release_date_str = release_date_str.split('T')[0]
                release_date = date.fromisoformat(release_date_str)
            elif isinstance(release_date_str, date):
                release_date = release_date_str
        
        albums_payload = data.get('albums')
        albums: list[dict] = []
        if isinstance(albums_payload, list):
            for album_ref in albums_payload:
                if not isinstance(album_ref, dict):
                    continue
                albums.append(
                    {
                        'disc_uid': album_ref.get('disc_uid'),
                        'name': album_ref.get('name', ''),
                        'track_number': album_ref.get('track_number'),
                    }
                )
        else:
            album_ref = data.get('album')
            if isinstance(album_ref, dict):
                albums.append(
                    {
                        'disc_uid': album_ref.get('disc_uid') or data.get('disc_uid'),
                        'name': album_ref.get('name', ''),
                        'track_number': data.get('track_number'),
                    }
                )
            elif album_ref or data.get('disc_uid') or data.get('track_number') is not None:
                albums.append(
                    {
                        'disc_uid': data.get('disc_uid'),
                        'name': str(album_ref or ''),
                        'track_number': data.get('track_number'),
                    }
                )

        primary_disc_uid = data.get('disc_uid')
        if not primary_disc_uid and albums:
            primary_disc_uid = albums[0].get('disc_uid')

        return cls(
            uid=data.get('uid', str(uuid.uuid4())),
            group_uid=data.get('group_uid'),
            group_name=data.get('group_name', ''),
            title=data.get('title', ''),
            title_romanji=data.get('title_romanji', ''),
            release_date=release_date,
            genre=data.get('genre', ''),
            duration=data.get('duration'),
            lyrics=data.get('lyrics', ''),
            composer=data.get('composer', ''),
            lyricist=data.get('lyricist', ''),
            arrangement=data.get('arrangement', ''),
            description=data.get('description', ''),
            spotify_url=data.get('spotify_url'),
            youtube_url=data.get('youtube_url'),
            albums=albums,
            version=data.get('version', ''),
            disc_uid=primary_disc_uid,
            popularity=data.get('popularity'),
            signature_song=bool(data.get('signature_song', False)),
            popularity_local=data.get('popularity_local'),
            popularity_global=data.get('popularity_global'),
            source_confidence=data.get('source_confidence', ''),
            notes=data.get('notes', ''),
            hidden=bool(data.get('hidden', False)),
        )
    
    def __str__(self) -> str:
        """String representation."""
        return f"Song(title='{self.title}')"
    
    def __repr__(self) -> str:
        """Detailed representation."""
        return (f"Song(title='{self.title}', "
                f"release_date={self.release_date}, "
                f"genre='{self.genre}')")

