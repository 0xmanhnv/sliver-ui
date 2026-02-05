"""
Custom exceptions for the application
"""

from typing import Any, Optional


class SliverUIException(Exception):
    """Base exception for SliverUI"""

    def __init__(self, message: str, details: Optional[Any] = None):
        self.message = message
        self.details = details
        super().__init__(self.message)


class AuthenticationError(SliverUIException):
    """Authentication failed"""

    pass


class AuthorizationError(SliverUIException):
    """User not authorized for this action"""

    pass


class NotFoundError(SliverUIException):
    """Resource not found"""

    pass


class ValidationError(SliverUIException):
    """Validation failed"""

    pass


class SliverConnectionError(SliverUIException):
    """Failed to connect to Sliver server"""

    pass


class SliverCommandError(SliverUIException):
    """Sliver command execution failed"""

    pass


class RateLimitError(SliverUIException):
    """Rate limit exceeded"""

    pass
