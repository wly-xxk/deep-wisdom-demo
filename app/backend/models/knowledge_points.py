from core.database import Base
from datetime import datetime as PyDateTime
from typing import Optional
from sqlalchemy import DateTime, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column


class Knowledge_points(Base):
    __tablename__ = "knowledge_points"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    definition: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    key_points: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)
    common_exam_points: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)
    related_technologies: Mapped[Optional[list[str]]] = mapped_column(ARRAY(String), nullable=True)
    version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    feedback_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    doc: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now)
    updated_at: Mapped[Optional[PyDateTime]] = mapped_column(DateTime(timezone=True), default=PyDateTime.now, onupdate=PyDateTime.now)