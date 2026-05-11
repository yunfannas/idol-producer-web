"""
Publish module for Idol Producer game.

Contains classes for various published works and media.
"""

from publish.publisher import Publisher
from publish.disc import Disc
from publish.tv import TV
from publish.musical import Musical
from publish.book import Book
from publish.magazine import Magazine

__all__ = ['Publisher', 'Disc', 'TV', 'Musical', 'Book', 'Magazine']

