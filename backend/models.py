import uuid
import time
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Boolean, Integer, Text, JSON
from database import Base


class Paste(Base):
    __tablename__ = "pastes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type: Mapped[str] = mapped_column(String(10))  # 'text' | 'file'

    # Text paste fields
    iv: Mapped[str | None] = mapped_column(Text, nullable=True)
    ciphertext: Mapped[str | None] = mapped_column(Text, nullable=True)

    # File paste fields
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(127), nullable=True)
    total_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Chunks stored as JSON: list of {iv, ciphertext}
    chunks: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Options
    burn_after_read: Mapped[bool] = mapped_column(Boolean, default=False)
    # Unix timestamp; null = never expires
    expires_at: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[int] = mapped_column(Integer, default=lambda: int(time.time()))
