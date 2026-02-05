"""
Browser cookie data model for storing extracted cookies
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, utc_now

if TYPE_CHECKING:
    from .user import User


class BrowserCookie(Base):
    """Extracted browser cookies stored for export and replay"""

    __tablename__ = "browser_cookies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    hostname: Mapped[str] = mapped_column(String(255), index=True, default="")
    browser: Mapped[str] = mapped_column(String(32), nullable=False)
    method: Mapped[str] = mapped_column(String(32), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    path: Mapped[str] = mapped_column(String(1024), default="/")
    expires: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    secure: Mapped[bool] = mapped_column(Boolean, default=False)
    http_only: Mapped[bool] = mapped_column(Boolean, default=False)
    same_site: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    extracted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, nullable=False
    )
    extracted_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", backref="browser_cookies")

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization"""
        return {
            "id": self.id,
            "session_id": self.session_id,
            "hostname": self.hostname,
            "browser": self.browser,
            "method": self.method,
            "domain": self.domain,
            "name": self.name,
            "value": self.value,
            "path": self.path,
            "expires": self.expires,
            "secure": self.secure,
            "http_only": self.http_only,
            "same_site": self.same_site,
            "extracted_at": self.extracted_at.isoformat() if self.extracted_at else None,
        }
