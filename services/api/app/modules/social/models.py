from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class SocialPost(Base):
    __tablename__ = "social_posts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    author_name: Mapped[str] = mapped_column(String(120))
    author_role: Mapped[str] = mapped_column(String(40), index=True)
    avatar: Mapped[str] = mapped_column(String(8), default="NX")
    workspace: Mapped[str] = mapped_column(String(120), default="Company")
    kind: Mapped[str] = mapped_column(String(40), default="post")
    content: Mapped[str] = mapped_column(Text)
    signal: Mapped[str] = mapped_column(String(120), default="live update")
    reactions: Mapped[int] = mapped_column(Integer, default=0)
    replies: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
