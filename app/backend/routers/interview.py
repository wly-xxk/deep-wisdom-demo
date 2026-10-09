"""Custom API for the InterviewPrep multi-agent workflow.

Endpoints map 1:1 to the four stages: JD analysis -> gap analysis -> mock
interview -> review report. Slow AI calls never run inside an open DB transaction.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.gap_analyses import Gap_analyses
from models.interview_sessions import Interview_sessions
from models.jd_analyses import Jd_analyses
from schemas.auth import UserResponse
from services.interview_agents import (
    analyze_gap,
    analyze_jd,
    generate_report,
    interviewer_turn,
)
from services.knowledge_tools import build_knowledge_index

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/interview", tags=["interview"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class AnalyzeJdRequest(BaseModel):
    jd_text: str = Field(..., min_length=20, description="Raw JD text pasted by the user")
    company: Optional[str] = Field(default="", description="Optional company override")
    position: Optional[str] = Field(default="", description="Optional position override")


class AnalyzeJdResponse(BaseModel):
    jd_id: int
    company: str = ""
    position: str = ""
    summary: str = ""
    abilities: List[Dict[str, Any]] = []
    knowledge_tags: List[Dict[str, Any]] = []


class AnalyzeGapRequest(BaseModel):
    jd_id: int
    resume_text: str = Field(..., min_length=20, description="Raw resume text")


class AnalyzeGapResponse(BaseModel):
    gap_id: int
    jd_id: int
    gaps: List[Dict[str, Any]] = []
    summary: str = ""


class StartSessionRequest(BaseModel):
    jd_id: int
    gap_id: Optional[int] = None


class AnswerRequest(BaseModel):
    session_id: int
    answer: str = ""
    user_ended: bool = False


class SessionIdRequest(BaseModel):
    session_id: int


class UpdateAbilitiesRequest(BaseModel):
    jd_id: int
    abilities: List[Dict[str, Any]]


def _session_view(session: Interview_sessions) -> Dict[str, Any]:
    return {
        "id": session.id,
        "jd_id": session.jd_id,
        "gap_id": session.gap_id,
        "company": session.company or "",
        "position": session.position or "",
        "abilities": session.abilities or [],
        "gaps": session.gaps or [],
        "abilities_examined": session.abilities_examined or [],
        "abilities_remaining": session.abilities_remaining or [],
        "current_ability_id": session.current_ability_id,
        "dialogue": session.dialogue or [],
        "round_count": session.round_count or 0,
        "status": session.status or "ongoing",
        "report": session.report,
    }


async def _load_jd(db: AsyncSession, jd_id: int, user_id: str) -> Jd_analyses:
    record = await db.get(Jd_analyses, jd_id)
    if not record or str(record.user_id) != str(user_id):
        raise HTTPException(status_code=404, detail="JD 分析记录不存在")
    return record


async def _load_session(db: AsyncSession, session_id: int, user_id: str) -> Interview_sessions:
    record = await db.get(Interview_sessions, session_id)
    if not record or str(record.user_id) != str(user_id):
        raise HTTPException(status_code=404, detail="面试会话不存在")
    return record


# ---------------------------------------------------------------------------
# Stage 1: JD analysis
# ---------------------------------------------------------------------------


@router.post("/analyze_jd", response_model=AnalyzeJdResponse)
async def analyze_jd_endpoint(
    data: AnalyzeJdRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Agent 1 — parse the JD into an ability matrix and link the knowledge base."""
    try:
        result = await analyze_jd(db, data.jd_text, data.company or "", data.position or "")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.error("JD analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="JD 分析失败，请稍后重试")

    record = Jd_analyses(
        user_id=str(current_user.id),
        company=result["company"],
        position=result["position"],
        jd_text=data.jd_text,
        abilities=result["abilities"],
        summary=result["summary"],
        status=result["status"],
    )
    db.add(record)
    await db.commit()

    return AnalyzeJdResponse(
        jd_id=record.id,
        company=result["company"],
        position=result["position"],
        summary=result["summary"],
        abilities=result["abilities"],
        knowledge_tags=result["knowledge_tags"],
    )


@router.post("/update_abilities")
async def update_abilities_endpoint(
    data: UpdateAbilitiesRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist ability-matrix edits (priority adjustments) for a JD analysis."""
    jd = await _load_jd(db, data.jd_id, str(current_user.id))
    jd.abilities = data.abilities
    await db.commit()
    return {"jd_id": data.jd_id, "abilities": data.abilities}


# ---------------------------------------------------------------------------
# Stage 2: Gap analysis
# ---------------------------------------------------------------------------


@router.post("/analyze_gap", response_model=AnalyzeGapResponse)
async def analyze_gap_endpoint(
    data: AnalyzeGapRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pipeline step — compare the ability matrix against resume evidence."""
    jd = await _load_jd(db, data.jd_id, str(current_user.id))
    abilities = jd.abilities or []
    await db.commit()

    if not abilities:
        raise HTTPException(status_code=422, detail="该 JD 记录没有能力矩阵，请重新分析 JD")

    try:
        result = await analyze_gap(abilities, data.resume_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        logger.error("Gap analysis failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="差距分析失败，请稍后重试")

    record = Gap_analyses(
        user_id=str(current_user.id),
        jd_id=data.jd_id,
        resume_text=data.resume_text,
        gaps=result["gaps"],
        summary=result["summary"],
    )
    db.add(record)
    await db.commit()

    return AnalyzeGapResponse(
        gap_id=record.id, jd_id=data.jd_id, gaps=result["gaps"], summary=result["summary"]
    )


# ---------------------------------------------------------------------------
# Stage 3: Mock interview
# ---------------------------------------------------------------------------


def _all_tech_names(abilities: List[Dict[str, Any]]) -> List[str]:
    names: List[str] = []
    for ability in abilities:
        for tech in ability.get("technologies", []) or []:
            if isinstance(tech, str) and tech.strip() and tech.strip() not in names:
                names.append(tech.strip())
    return names


@router.post("/start_session")
async def start_session_endpoint(
    data: StartSessionRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Agent 2 — open a stateful mock interview and ask the first question."""
    jd = await _load_jd(db, data.jd_id, str(current_user.id))
    abilities = jd.abilities or []
    gaps: List[Dict[str, Any]] = []
    gap_id = data.gap_id
    if gap_id:
        gap_record = await db.get(Gap_analyses, gap_id)
        if not gap_record or str(gap_record.user_id) != str(current_user.id):
            raise HTTPException(status_code=404, detail="差距分析记录不存在")
        gaps = gap_record.gaps or []
    if not abilities:
        raise HTTPException(status_code=422, detail="该 JD 记录没有能力矩阵，请重新分析 JD")

    ability_ids = [str(item.get("id")) for item in abilities if item.get("id")]
    session = Interview_sessions(
        user_id=str(current_user.id),
        jd_id=data.jd_id,
        gap_id=gap_id,
        company=jd.company or "",
        position=jd.position or "",
        abilities=abilities,
        gaps=gaps,
        abilities_examined=[],
        abilities_remaining=ability_ids,
        current_ability_id=None,
        dialogue=[],
        round_count=0,
        status="ongoing",
        report=None,
    )
    db.add(session)
    await db.flush()
    session_id = session.id
    await db.commit()

    knowledge_index = await build_knowledge_index(db, _all_tech_names(abilities))
    await db.commit()

    turn = await interviewer_turn(
        abilities=abilities,
        gaps=gaps,
        dialogue=[],
        examined=[],
        remaining=ability_ids,
        current_ability_id=None,
        round_count=0,
        knowledge_index=knowledge_index,
    )

    session.dialogue = turn["records"]
    session.abilities_examined = turn["abilities_examined"]
    session.abilities_remaining = turn["abilities_remaining"]
    session.current_ability_id = turn["current_ability_id"]
    session.round_count = turn["round_count"]
    session.status = turn["status"]
    await db.commit()

    return {"session_id": session_id, "session": _session_view(session)}


@router.post("/answer")
async def answer_endpoint(
    data: AnswerRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit one answer; the interviewer scores it, decides, calls tools, asks again."""
    session = await _load_session(db, data.session_id, str(current_user.id))
    if session.status == "finished" and not data.user_ended:
        return {"session": _session_view(session)}

    abilities = session.abilities or []
    gaps = session.gaps or []
    dialogue = list(session.dialogue or [])
    examined = [str(x) for x in (session.abilities_examined or [])]
    remaining = [str(x) for x in (session.abilities_remaining or [])]
    current_ability_id = session.current_ability_id
    round_count = session.round_count or 0
    answer = (data.answer or "").strip()
    await db.commit()

    if answer:
        dialogue.append(
            {
                "role": "user",
                "type": "answer",
                "ability_id": str(current_ability_id) if current_ability_id else "",
                "content": answer,
            }
        )

    knowledge_index = await build_knowledge_index(db, _all_tech_names(abilities))
    await db.commit()

    try:
        turn = await interviewer_turn(
            abilities=abilities,
            gaps=gaps,
            dialogue=dialogue,
            examined=examined,
            remaining=remaining,
            current_ability_id=current_ability_id,
            round_count=round_count,
            knowledge_index=knowledge_index,
            user_answer=answer or None,
            user_ended=data.user_ended,
        )
    except Exception as exc:  # noqa: BLE001
        logger.error("Interviewer turn failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="面试官响应失败，请重试本题")

    session.dialogue = dialogue + turn["records"]
    session.abilities_examined = turn["abilities_examined"]
    session.abilities_remaining = turn["abilities_remaining"]
    session.current_ability_id = turn["current_ability_id"]
    session.round_count = turn["round_count"]
    session.status = turn["status"]
    await db.commit()

    return {"session": _session_view(session)}


# ---------------------------------------------------------------------------
# Stage 4: Review report
# ---------------------------------------------------------------------------


@router.post("/generate_report")
async def generate_report_endpoint(
    data: SessionIdRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Agent 3 — turn the finished dialogue into a review report."""
    session = await _load_session(db, data.session_id, str(current_user.id))
    abilities = session.abilities or []
    gaps = session.gaps or []
    dialogue = list(session.dialogue or [])
    company = session.company or ""
    position = session.position or ""
    await db.commit()

    if not any(m.get("type") == "feedback" for m in dialogue):
        raise HTTPException(status_code=422, detail="还没有已回答的题目，无法生成复盘报告")

    try:
        report = await generate_report(abilities, gaps, dialogue, company, position)
    except Exception as exc:  # noqa: BLE001
        logger.error("Report generation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="复盘报告生成失败，请稍后重试")

    session.report = report
    session.status = "finished"
    await db.commit()

    return {"session": _session_view(session)}


# ---------------------------------------------------------------------------
# History
# ---------------------------------------------------------------------------


@router.get("/sessions")
async def list_sessions(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's interview sessions, newest first."""
    result = await db.execute(
        select(Interview_sessions)
        .where(Interview_sessions.user_id == str(current_user.id))
        .order_by(Interview_sessions.id.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return {
        "items": [
            {
                "id": row.id,
                "company": row.company or "",
                "position": row.position or "",
                "round_count": row.round_count or 0,
                "status": row.status or "ongoing",
                "overall_score": (row.report or {}).get("overall_score") if row.report else None,
                "created_at": row.created_at.isoformat() if row.created_at else None,
            }
            for row in sessions
        ]
    }


@router.get("/session/{session_id}")
async def get_session(
    session_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Load one interview session with its full dialogue and report."""
    session = await _load_session(db, session_id, str(current_user.id))
    return {"session": _session_view(session)}


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete one interview session."""
    session = await _load_session(db, session_id, str(current_user.id))
    await db.delete(session)
    await db.commit()
    return {"message": "面试会话已删除", "id": session_id}
