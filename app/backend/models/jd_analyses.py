from core.database import Base
from datetime import datetime as PyDateTime
from typing import Optional
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column


class Jd_analyses(Base):
    __tablename__ = "jd_analyses"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    company: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    jd_text: Mapped[str] = mapped_column(String, nullable=False)
    abilities: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now)
    updated_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now, onupdate=PyDateTime.now)