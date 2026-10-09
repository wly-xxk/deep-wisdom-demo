from core.database import Base
from datetime import datetime as PyDateTime
from typing import Optional
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class Interview_sessions(Base):
    __tablename__ = "interview_sessions"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    jd_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    gap_id: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    company: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    abilities: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    gaps: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    abilities_examined: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    abilities_remaining: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    current_ability_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    dialogue: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    round_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    report: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now)
    updated_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now, onupdate=PyDateTime.now)