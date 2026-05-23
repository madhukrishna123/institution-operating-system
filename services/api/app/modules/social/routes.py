from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.platform.models import UserAccount
from app.modules.platform.routes import current_user
from app.modules.social.models import SocialPost

router = APIRouter()


def role_label(role: str) -> str:
    return " ".join(part.capitalize() for part in role.split("_"))


def avatar_for(name: str) -> str:
    parts = [part[0] for part in name.split() if part]
    return "".join(parts[:2]).upper() or "NX"


def ensure_social_seed(db: Session) -> None:
    if db.scalar(select(SocialPost.id).limit(1)):
        return
    seed_posts = [
        SocialPost(
            author_name="Maya Chen",
            author_role="Workspace Lead",
            avatar="MC",
            workspace="Product Studio",
            kind="launch",
            content="The onboarding flow is now a living canvas: profile, team context, and copilot setup land in one pass.",
            signal="launch note",
            reactions=48,
            replies=12,
        ),
        SocialPost(
            author_name="Ari Dev",
            author_role="AI Systems",
            avatar="AD",
            workspace="Copilot Lab",
            kind="agent",
            content="Copilot Agent prepared three draft summaries from channel activity and queued them for human review.",
            signal="agent draft",
            reactions=34,
            replies=8,
        ),
        SocialPost(
            author_name="Nora Singh",
            author_role="Community Ops",
            avatar="NS",
            workspace="People Network",
            kind="community",
            content="New makers circle opens today: design critiques, build logs, and quick demos every Friday.",
            signal="community pulse",
            reactions=76,
            replies=19,
        ),
        SocialPost(
            author_name="Kai Morgan",
            author_role="Revenue Ops",
            avatar="KM",
            workspace="Enterprise GTM",
            kind="dashboard",
            content="Smart dashboard flagged renewals that need executive context. Follow-up briefs are attached for review.",
            signal="decision queue",
            reactions=29,
            replies=6,
        ),
    ]
    db.add_all(seed_posts)
    db.commit()


def feed_items(db: Session) -> list[dict]:
    ensure_social_seed(db)
    posts = db.scalars(select(SocialPost).order_by(SocialPost.id.desc())).all()
    return [
        {
            "id": post.id,
            "author": post.author_name,
            "role": post.author_role,
            "avatar": post.avatar,
            "workspace": post.workspace,
            "kind": post.kind,
            "content": post.content,
            "signal": post.signal,
            "reactions": post.reactions,
            "replies": post.replies,
            "time": post.created_at.strftime("%I:%M %p").lstrip("0"),
        }
        for post in posts
    ]


def workspace_items(user: UserAccount) -> list[dict]:
    accent = {
        "admin": "cyan",
        "super_admin": "violet",
        "teacher": "emerald",
        "finance": "amber",
        "hr": "rose",
        "student": "sky",
        "parent": "teal",
    }.get(user.role, "cyan")
    return [
        {
            "id": "product-studio",
            "name": "Product Studio",
            "agent": "Workspace Agent",
            "accent": accent,
            "status": "Design sprint live",
            "members": 18,
            "threads": 42,
            "pinned": ["Launch board", "Decision log", "Customer clips"],
        },
        {
            "id": "copilot-lab",
            "name": "Copilot Lab",
            "agent": "Copilot Agent",
            "accent": "violet",
            "status": "7 drafts awaiting review",
            "members": 9,
            "threads": 23,
            "pinned": ["Agent policy", "Prompt patterns", "Approval queue"],
        },
        {
            "id": "people-network",
            "name": "People Network",
            "agent": "Profile Agent",
            "accent": "rose",
            "status": "Community pulse rising",
            "members": 64,
            "threads": 31,
            "pinned": ["New joiners", "Skills graph", "Creator circles"],
        },
    ]


def copilot_items(user: UserAccount) -> list[dict]:
    return [
        {
            "agent": "Shell Agent",
            "title": "Morning command layer is ready",
            "summary": f"Prioritized {role_label(user.role)} workspace signals, unread channels, and open decision items.",
            "confidence": "high",
            "action": "Open command review",
        },
        {
            "agent": "Feed Agent",
            "title": "Social signal cluster detected",
            "summary": "Three updates mention onboarding friction. Draft a synthesis before the next product sync.",
            "confidence": "medium",
            "action": "Draft synthesis",
        },
        {
            "agent": "Messaging Agent",
            "title": "Catch-up brief available",
            "summary": "The Copilot Lab channel has 14 unread messages; five are decisions, two need replies.",
            "confidence": "high",
            "action": "Generate brief",
        },
    ]


def message_items() -> list[dict]:
    return [
        {
            "channel": "#product-studio",
            "sender": "Maya",
            "preview": "Can we pin the new onboarding prototype?",
            "unread": 6,
            "tone": "cyan",
        },
        {
            "channel": "#copilot-lab",
            "sender": "Ari",
            "preview": "Agent draft policy is ready for approval.",
            "unread": 14,
            "tone": "violet",
        },
        {
            "channel": "DM Nora",
            "sender": "Nora",
            "preview": "Loved the creator-style profile direction.",
            "unread": 2,
            "tone": "rose",
        },
    ]


def profile_for(user: UserAccount) -> dict:
    return {
        "name": user.name,
        "email": user.email,
        "role": role_label(user.role),
        "avatar": avatar_for(user.name),
        "headline": "Future-ready operator building intelligent collaboration loops.",
        "skills": ["AI workflows", "Team rhythm", "Decision design", "Community"],
        "badges": ["Signal Builder", "Fast Reviewer", "Agent Partner"],
        "stats": [
            {"label": "Posts", "value": "128"},
            {"label": "Collabs", "value": "34"},
            {"label": "AI Saves", "value": "19h"},
        ],
    }


@router.get("/home")
def social_home(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    return {
        "profile": profile_for(user),
        "feed": feed_items(db),
        "workspaces": workspace_items(user),
        "copilots": copilot_items(user),
        "messages": message_items(),
    }


@router.get("/feed")
def social_feed(db: Session = Depends(get_db), user: UserAccount = Depends(current_user)) -> list[dict]:
    return feed_items(db)


@router.post("/feed")
def create_social_post(
    payload: dict,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    content = str(payload.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Post content is required")
    post = SocialPost(
        author_name=user.name,
        author_role=role_label(user.role),
        avatar=avatar_for(user.name),
        workspace=str(payload.get("workspace") or "Company"),
        kind=str(payload.get("kind") or "post"),
        content=content,
        signal="fresh post",
        reactions=0,
        replies=0,
        created_at=datetime.utcnow(),
    )
    db.add(post)
    db.commit()
    return {"status": "created", "id": post.id}


@router.get("/workspaces")
def social_workspaces(user: UserAccount = Depends(current_user)) -> list[dict]:
    return workspace_items(user)


@router.get("/messages")
def social_messages(user: UserAccount = Depends(current_user)) -> list[dict]:
    return message_items()


@router.get("/profile")
def social_profile(user: UserAccount = Depends(current_user)) -> dict:
    return profile_for(user)
