"""Custom API for the global knowledge base and per-user private marks."""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.knowledge_marks import Knowledge_marks
from models.knowledge_points import Knowledge_points
from schemas.auth import UserResponse
from services.knowledge_tools import knowledge_point_view, list_knowledge_points

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/knowledge", tags=["knowledge"])


class MarkUpdateRequest(BaseModel):
    tech_id: int
    tech_name: Optional[str] = ""
    mastery: Optional[str] = Field(default="learning", description="learning / familiar / mastered")
    favorited: Optional[bool] = False
    personal_notes: Optional[str] = ""


def _mark_view(mark: Knowledge_marks) -> Dict[str, Any]:
    return {
        "id": mark.id,
        "tech_id": mark.tech_id,
        "tech_name": mark.tech_name or "",
        "mastery": mark.mastery or "learning",
        "favorited": bool(mark.favorited),
        "personal_notes": mark.personal_notes or "",
    }


async def _load_point(db: AsyncSession, tech_id: int) -> Knowledge_points:
    point = await db.get(Knowledge_points, tech_id)
    if not point:
        raise HTTPException(status_code=404, detail="知识点不存在")
    return point


@router.get("/points")
async def get_points(
    keyword: str = Query("", description="Optional name keyword filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List global knowledge points together with the current user's private marks."""
    result = await list_knowledge_points(db, skip=skip, limit=limit, keyword=keyword)
    points = result["items"]
    total = result["total"]

    marks_result = await db.execute(
        select(Knowledge_marks).where(Knowledge_marks.user_id == str(current_user.id))
    )
    mark_by_tech = {mark.tech_id: _mark_view(mark) for mark in marks_result.scalars().all()}

    items = []
    for point in points:
        view = knowledge_point_view(point)
        view["feedback_count"] = point.feedback_count or 0
        view["version"] = point.version or 1
        view["mark"] = mark_by_tech.get(point.id)
        items.append(view)

    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/point/{tech_id}")
async def get_point(
    tech_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Load one knowledge point with its related knowledge points and the user's mark."""
    point = await _load_point(db, tech_id)
    view = knowledge_point_view(point)
    view["feedback_count"] = point.feedback_count or 0
    view["version"] = point.version or 1

    related: List[Dict[str, Any]] = []
    for name in (point.related_technologies or [])[:6]:
        result = await db.execute(
            select(Knowledge_points).where(Knowledge_points.name == name).limit(1)
        )
        neighbor = result.scalars().first()
        if neighbor and neighbor.id != point.id:
            related.append({"id": neighbor.id, "name": neighbor.name, "category": neighbor.category})

    marks_result = await db.execute(
        select(Knowledge_marks).where(
            Knowledge_marks.user_id == str(current_user.id), Knowledge_marks.tech_id == tech_id
        )
    )
    mark = marks_result.scalars().first()

    return {"point": view, "related": related, "mark": _mark_view(mark) if mark else None}


@router.post("/mark")
async def upsert_mark(
    data: MarkUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the current user's private mark for a knowledge point."""
    point = await _load_point(db, data.tech_id)

    result = await db.execute(
        select(Knowledge_marks).where(
            Knowledge_marks.user_id == str(current_user.id),
            Knowledge_marks.tech_id == data.tech_id,
        )
    )
    mark = result.scalars().first()

    if mark is None:
        mark = Knowledge_marks(user_id=str(current_user.id), tech_id=data.tech_id)
        db.add(mark)

    mark.tech_name = (data.tech_name or point.name or "").strip()
    mark.mastery = data.mastery or "learning"
    mark.favorited = bool(data.favorited)
    mark.personal_notes = data.personal_notes or ""
    await db.commit()

    return {"mark": _mark_view(mark)}


@router.get("/marks")
async def list_marks(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all private marks of the current user."""
    result = await db.execute(
        select(Knowledge_marks)
        .where(Knowledge_marks.user_id == str(current_user.id))
        .order_by(Knowledge_marks.id.desc())
    )
    return {"items": [_mark_view(mark) for mark in result.scalars().all()]}
