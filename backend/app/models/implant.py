"""
Implant tracking data model
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class TrackedImplant(Base, TimestampMixin):
    """Track implant builds, deployment status, and lifecycle"""

    __tablename__ = "tracked_implants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    version: Mapped[str] = mapped_column(String(32), default="1.0")
    build_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    c2_domains: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    deployed_target: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(32), default="built", nullable=False, index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sha256_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "build_date": self.build_date.isoformat() if self.build_date else None,
            "c2_domains": self.c2_domains,
            "deployed_target": self.deployed_target,
            "status": self.status,
            "notes": self.notes,
            "sha256_hash": self.sha256_hash,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
