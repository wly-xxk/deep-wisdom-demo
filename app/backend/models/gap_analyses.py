from core.database import Base
from datetime import datetime as PyDateTime
from typing import Optional
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class Gap_analyses(Base):
    __tablename__ = "gap_analyses"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    jd_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    resume_text: Mapped[str] = mapped_column(String, nullable=False)
    gaps: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now)
    updated_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now, onupdate=PyDateTime.now)