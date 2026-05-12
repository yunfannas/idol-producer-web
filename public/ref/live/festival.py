"""
Festival data structures for Idol Producer game.

Represents multi-day idol festivals with stages, lineup, and timetable slots.
"""

from dataclasses import dataclass, field
from typing import List, Optional
import uuid


@dataclass
class FestivalStage:
    """Single named stage inside a festival."""

    name: str
    location: str = ""
    code: str = ""
    timetable_key: str = ""
    logo: str = ""
    coming_soon: bool = False
    is_main_stage: bool = False

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "location": self.location,
            "code": self.code,
            "timetable_key": self.timetable_key,
            "logo": self.logo,
            "coming_soon": self.coming_soon,
            "is_main_stage": self.is_main_stage,
        }

    @classmethod
    def create_from_dict(cls, data: dict) -> "FestivalStage":
        return cls(
            name=data.get("name", ""),
            location=data.get("location", ""),
            code=data.get("code", ""),
            timetable_key=data.get("timetable_key", ""),
            logo=data.get("logo", ""),
            coming_soon=bool(data.get("coming_soon", False)),
            is_main_stage=bool(data.get("is_main_stage", False)),
        )


@dataclass
class FestivalAppearance:
    """Festival lineup-level group appearance information."""

    name: str
    appearance_dates: List[str] = field(default_factory=list)
    group_uid: Optional[str] = None
    official_site: Optional[str] = None
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "appearance_dates": self.appearance_dates,
            "group_uid": self.group_uid,
            "official_site": self.official_site,
            "tags": self.tags,
        }

    @classmethod
    def create_from_dict(cls, data: dict) -> "FestivalAppearance":
        return cls(
            name=data.get("name", ""),
            appearance_dates=list(data.get("appearance_dates", [])),
            group_uid=data.get("group_uid"),
            official_site=data.get("official_site"),
            tags=list(data.get("tags", [])),
        )


@dataclass
class FestivalPerformance:
    """Single performance slot in a festival timetable."""

    date: str
    stage: str
    start_time: str
    end_time: str
    artist_name: str
    title: str = ""
    subtitle: str = ""
    group_uid: Optional[str] = None
    photo_flag: bool = False
    premier_flag: bool = False
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "stage": self.stage,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "artist_name": self.artist_name,
            "title": self.title,
            "subtitle": self.subtitle,
            "group_uid": self.group_uid,
            "photo_flag": self.photo_flag,
            "premier_flag": self.premier_flag,
            "notes": self.notes,
        }

    @classmethod
    def create_from_dict(cls, data: dict) -> "FestivalPerformance":
        return cls(
            date=data.get("date", ""),
            stage=data.get("stage", ""),
            start_time=data.get("start_time", ""),
            end_time=data.get("end_time", ""),
            artist_name=data.get("artist_name", ""),
            title=data.get("title", ""),
            subtitle=data.get("subtitle", ""),
            group_uid=data.get("group_uid"),
            photo_flag=bool(data.get("photo_flag", False)),
            premier_flag=bool(data.get("premier_flag", False)),
            notes=data.get("notes", ""),
        )


@dataclass
class Festival:
    """Multi-day idol festival with lineup and timetable data."""

    uid: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    name_romanji: str = ""
    festival_series: str = ""
    edition_number: Optional[int] = None
    anniversary_number: Optional[int] = None
    inaugural_year: Optional[int] = None
    organizer: str = ""
    supporter: str = ""
    official_url: str = ""
    about_url: str = ""
    lineup_url: str = ""
    timetable_url: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    location: str = ""
    description: str = ""
    stages: List[FestivalStage] = field(default_factory=list)
    appearances: List[FestivalAppearance] = field(default_factory=list)
    performances: List[FestivalPerformance] = field(default_factory=list)
    timetable_pdf_urls: List[str] = field(default_factory=list)
    notes: str = ""

    def to_dict(self) -> dict:
        return {
            "uid": self.uid,
            "name": self.name,
            "name_romanji": self.name_romanji,
            "festival_series": self.festival_series,
            "edition_number": self.edition_number,
            "anniversary_number": self.anniversary_number,
            "inaugural_year": self.inaugural_year,
            "organizer": self.organizer,
            "supporter": self.supporter,
            "official_url": self.official_url,
            "about_url": self.about_url,
            "lineup_url": self.lineup_url,
            "timetable_url": self.timetable_url,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "location": self.location,
            "description": self.description,
            "stages": [stage.to_dict() for stage in self.stages],
            "appearances": [appearance.to_dict() for appearance in self.appearances],
            "performances": [performance.to_dict() for performance in self.performances],
            "timetable_pdf_urls": self.timetable_pdf_urls,
            "notes": self.notes,
        }

    @classmethod
    def create_from_dict(cls, data: dict) -> "Festival":
        return cls(
            uid=data.get("uid", str(uuid.uuid4())),
            name=data.get("name", ""),
            name_romanji=data.get("name_romanji", ""),
            festival_series=data.get("festival_series", ""),
            edition_number=data.get("edition_number"),
            anniversary_number=data.get("anniversary_number"),
            inaugural_year=data.get("inaugural_year"),
            organizer=data.get("organizer", ""),
            supporter=data.get("supporter", ""),
            official_url=data.get("official_url", ""),
            about_url=data.get("about_url", ""),
            lineup_url=data.get("lineup_url", ""),
            timetable_url=data.get("timetable_url", ""),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            location=data.get("location", ""),
            description=data.get("description", ""),
            stages=[FestivalStage.create_from_dict(stage) for stage in data.get("stages", [])],
            appearances=[FestivalAppearance.create_from_dict(item) for item in data.get("appearances", [])],
            performances=[FestivalPerformance.create_from_dict(item) for item in data.get("performances", [])],
            timetable_pdf_urls=list(data.get("timetable_pdf_urls", [])),
            notes=data.get("notes", ""),
        )
