"""
Session notes and tags models
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Index, Integer, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship

from app.models.base import Base

# Many-to-many relationship table for session tags
session_tags = Table(
    "session_tags",
    Base.metadata,
    Column("session_id", String(64), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id"), primary_key=True),
)


class SessionNote(Base):
    """Notes attached to sessions/beacons"""

    __tablename__ = "session_notes"
    __table_args__ = (Index("ix_session_notes_sid_type", "session_id", "session_type"),)

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(
        String(64), index=True, nullable=False
    )  # Sliver session/beacon ID
    session_type = Column(String(16), default="session")  # 'session' or 'beacon'
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    user = relationship("User", backref="session_notes")


class Tag(Base):
    """Tags for organizing sessions/beacons"""

    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, nullable=False, index=True)
    color = Column(String(7), default="#6366f1")  # Hex color
    description = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class SessionTag(Base):
    """Association between sessions and tags"""

    __tablename__ = "session_tag_associations"
    __table_args__ = (
        Index("ix_session_tag_sid_tid", "session_id", "tag_id"),
        Index("ix_session_tag_sid_type", "session_id", "session_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), index=True, nullable=False)
    session_type = Column(String(16), default="session")
    tag_id = Column(Integer, ForeignKey("tags.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    tag = relationship("Tag", backref="session_associations")


class CommandHistory(Base):
    """Command history for sessions"""

    __tablename__ = "command_history"
    __table_args__ = (Index("ix_cmd_history_sid_exec", "session_id", "executed_at"),)

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), index=True, nullable=False)
    session_type = Column(String(16), default="session")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    command = Column(Text, nullable=False)
    output = Column(Text)
    exit_code = Column(Integer)
    executed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", backref="command_history")
