from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class DailyQuestion(Base):
    """La pregunta del día y, cuando existe, la respuesta del dueño.

    Una sola tabla en vez de daily_question/daily_answer separadas (como
    sugiere el briefing): es una relación 1 a 1, así que una fila con
    `respuesta` nullable evita un join innecesario.
    """

    __tablename__ = "daily_question"

    id: Mapped[int] = mapped_column(primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business.id", ondelete="CASCADE"))
    pregunta: Mapped[str] = mapped_column(Text)
    respuesta: Mapped[str | None] = mapped_column(Text, default=None)
    fecha_pregunta: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    fecha_respuesta: Mapped[date | None] = mapped_column(Date, default=None)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
