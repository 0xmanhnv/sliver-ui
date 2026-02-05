"""
Session notes and tags endpoints
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.api.deps import get_db, require_permission
from app.models import User, SessionNote, Tag, SessionTag, CommandHistory

router = APIRouter()


# ═══════════════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════════════

class NoteCreate(BaseModel):
    session_id: str
    session_type: str = "session"
    content: str


class NoteUpdate(BaseModel):
    content: str


class NoteResponse(BaseModel):
    id: int
    session_id: str
    session_type: str
    content: str
    user_id: int
    username: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TagCreate(BaseModel):
    name: str
    color: str = "#6366f1"
    description: Optional[str] = None


class TagResponse(BaseModel):
    id: int
    name: str
    color: str
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SessionTagCreate(BaseModel):
    session_id: str
    session_type: str = "session"
    tag_id: int


class CommandHistoryResponse(BaseModel):
    id: int
    session_id: str
    command: str
    output: Optional[str]
    exit_code: Optional[int]
    username: str
    executed_at: datetime

    class Config:
        from_attributes = True


# ═══════════════════════════════════════════════════════════════════════════
# Notes Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/sessions/{session_id}/notes", response_model=List[NoteResponse])
async def get_session_notes(
    session_id: str,
    session_type: str = Query("session"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "read")),
):
    """Get all notes for a session"""
    result = await db.execute(
        select(SessionNote)
        .where(SessionNote.session_id == session_id)
        .where(SessionNote.session_type == session_type)
        .order_by(SessionNote.created_at.desc())
    )
    notes = result.scalars().all()

    return [
        NoteResponse(
            id=note.id,
            session_id=note.session_id,
            session_type=note.session_type,
            content=note.content,
            user_id=note.user_id,
            username=note.user.username if note.user else "Unknown",
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
        for note in notes
    ]


@router.post("/sessions/{session_id}/notes", response_model=NoteResponse)
async def create_note(
    session_id: str,
    note_data: NoteCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "write")),
):
    """Create a new note for a session"""
    note = SessionNote(
        session_id=session_id,
        session_type=note_data.session_type,
        user_id=user.id,
        content=note_data.content,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return NoteResponse(
        id=note.id,
        session_id=note.session_id,
        session_type=note.session_type,
        content=note.content,
        user_id=note.user_id,
        username=user.username,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_data: NoteUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "write")),
):
    """Update a note"""
    result = await db.execute(select(SessionNote).where(SessionNote.id == note_id))
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    note.content = note_data.content
    note.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(note)

    return NoteResponse(
        id=note.id,
        session_id=note.session_id,
        session_type=note.session_type,
        content=note.content,
        user_id=note.user_id,
        username=note.user.username if note.user else "Unknown",
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "write")),
):
    """Delete a note"""
    await db.execute(delete(SessionNote).where(SessionNote.id == note_id))
    await db.commit()
    return {"message": "Note deleted"}


# ═══════════════════════════════════════════════════════════════════════════
# Tags Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/tags", response_model=List[TagResponse])
async def list_tags(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "read")),
):
    """List all tags"""
    result = await db.execute(select(Tag).order_by(Tag.name))
    tags = result.scalars().all()
    return [TagResponse.model_validate(tag) for tag in tags]


@router.post("/tags", response_model=TagResponse)
async def create_tag(
    tag_data: TagCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "write")),
):
    """Create a new tag"""
    # Check if tag exists
    result = await db.execute(select(Tag).where(Tag.name == tag_data.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Tag already exists")

    tag = Tag(
        name=tag_data.name,
        color=tag_data.color,
        description=tag_data.description,
    )
    db.add(tag)
    await db.commit()
    await db.refresh(tag)

    return TagResponse.model_validate(tag)


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "write")),
):
    """Delete a tag"""
    # Delete associations first
    await db.execute(delete(SessionTag).where(SessionTag.tag_id == tag_id))
    await db.execute(delete(Tag).where(Tag.id == tag_id))
    await db.commit()
    return {"message": "Tag deleted"}


@router.get("/sessions/{session_id}/tags", response_model=List[TagResponse])
async def get_session_tags(
    session_id: str,
    session_type: str = Query("session"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "read")),
):
    """Get tags for a session"""
    result = await db.execute(
        select(Tag)
        .join(SessionTag)
        .where(SessionTag.session_id == session_id)
        .where(SessionTag.session_type == session_type)
    )
    tags = result.scalars().all()
    return [TagResponse.model_validate(tag) for tag in tags]


@router.post("/sessions/{session_id}/tags/{tag_id}")
async def add_tag_to_session(
    session_id: str,
    tag_id: int,
    session_type: str = Query("session"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "write")),
):
    """Add a tag to a session"""
    # Check if tag exists
    result = await db.execute(select(Tag).where(Tag.id == tag_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check if already tagged
    result = await db.execute(
        select(SessionTag)
        .where(SessionTag.session_id == session_id)
        .where(SessionTag.tag_id == tag_id)
    )
    if result.scalar_one_or_none():
        return {"message": "Tag already added"}

    session_tag = SessionTag(
        session_id=session_id,
        session_type=session_type,
        tag_id=tag_id,
    )
    db.add(session_tag)
    await db.commit()

    return {"message": "Tag added"}


@router.delete("/sessions/{session_id}/tags/{tag_id}")
async def remove_tag_from_session(
    session_id: str,
    tag_id: int,
    session_type: str = Query("session"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "write")),
):
    """Remove a tag from a session"""
    await db.execute(
        delete(SessionTag)
        .where(SessionTag.session_id == session_id)
        .where(SessionTag.tag_id == tag_id)
        .where(SessionTag.session_type == session_type)
    )
    await db.commit()
    return {"message": "Tag removed"}


# ═══════════════════════════════════════════════════════════════════════════
# Command History Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@router.get("/sessions/{session_id}/history", response_model=List[CommandHistoryResponse])
async def get_command_history(
    session_id: str,
    limit: int = Query(100, le=500),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "read")),
):
    """Get command history for a session"""
    result = await db.execute(
        select(CommandHistory)
        .where(CommandHistory.session_id == session_id)
        .order_by(CommandHistory.executed_at.desc())
        .limit(limit)
    )
    history = result.scalars().all()

    return [
        CommandHistoryResponse(
            id=cmd.id,
            session_id=cmd.session_id,
            command=cmd.command,
            output=cmd.output,
            exit_code=cmd.exit_code,
            username=cmd.user.username if cmd.user else "Unknown",
            executed_at=cmd.executed_at,
        )
        for cmd in history
    ]


@router.post("/sessions/{session_id}/history")
async def save_command_history(
    session_id: str,
    command: str,
    output: Optional[str] = None,
    exit_code: Optional[int] = None,
    session_type: str = Query("session"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "execute")),
):
    """Save a command to history"""
    history = CommandHistory(
        session_id=session_id,
        session_type=session_type,
        user_id=user.id,
        command=command,
        output=output,
        exit_code=exit_code,
    )
    db.add(history)
    await db.commit()

    return {"message": "Command saved to history"}


@router.get("/sessions/{session_id}/export")
async def export_session_data(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_permission("sessions", "read")),
):
    """Export all session data (notes, tags, history)"""
    # Get notes
    notes_result = await db.execute(
        select(SessionNote).where(SessionNote.session_id == session_id)
    )
    notes = [
        {
            "content": n.content,
            "user": n.user.username if n.user else "Unknown",
            "created_at": n.created_at.isoformat(),
        }
        for n in notes_result.scalars().all()
    ]

    # Get tags
    tags_result = await db.execute(
        select(Tag)
        .join(SessionTag)
        .where(SessionTag.session_id == session_id)
    )
    tags = [t.name for t in tags_result.scalars().all()]

    # Get history
    history_result = await db.execute(
        select(CommandHistory)
        .where(CommandHistory.session_id == session_id)
        .order_by(CommandHistory.executed_at)
    )
    history = [
        {
            "command": h.command,
            "output": h.output,
            "exit_code": h.exit_code,
            "user": h.user.username if h.user else "Unknown",
            "executed_at": h.executed_at.isoformat(),
        }
        for h in history_result.scalars().all()
    ]

    return {
        "session_id": session_id,
        "notes": notes,
        "tags": tags,
        "command_history": history,
        "exported_at": datetime.utcnow().isoformat(),
    }
