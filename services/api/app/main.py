from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.db import Base, engine
from app.modules.agents.routes import router as agents_router
from app.modules.attendance.models import AttendanceRecord
from app.modules.attendance.routes import router as attendance_router
from app.modules.fees.models import Invoice
from app.modules.fees.routes import router as fees_router
from app.modules.platform.models import (
    AgentCapability,
    AgentWorkItem,
    ApprovalRule,
    ConfigModule,
    Institution,
    ModuleField,
    ModuleFieldOption,
    ModuleRecordValue,
    MasterDataOption,
    MasterDataSet,
    Notice,
    ProfileFieldDefinition,
    ProfileFieldOption,
    ProfileFieldValue,
    RoleNavigation,
    UserAccount,
    WorkflowDefinition,
    WorkspaceWidget,
)
from app.modules.platform.routes import router as platform_router
from app.modules.platform.seed import seed_platform
from app.modules.social.models import SocialPost
from app.modules.social.routes import router as social_router
from app.modules.students.models import Student
from app.modules.students.routes import router as students_router
from app.settings import settings

app = FastAPI(title="AI Institution OS API", version="0.1.0")
cors_origins = [settings.web_origin]
if settings.environment != "production":
    cors_origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students_router, prefix="/api/students", tags=["students"])
app.include_router(attendance_router, prefix="/api/attendance", tags=["attendance"])
app.include_router(fees_router, prefix="/api/fees", tags=["fees"])
app.include_router(agents_router, prefix="/api/agents", tags=["agents"])
app.include_router(platform_router, prefix="/api", tags=["platform"])
app.include_router(social_router, prefix="/api/social", tags=["social"])


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_compatibility()
    from app.db import SessionLocal

    db = SessionLocal()
    try:
        seed_platform(db)
    finally:
        db.close()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-institution-os-api"}


@app.get("/api/ready")
def ready() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("select 1"))
    return {"status": "ready", "database": "ok"}


def ensure_sqlite_compatibility() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as connection:
        user_columns = [
            row[1]
            for row in connection.execute(text("PRAGMA table_info(user_accounts)")).fetchall()
        ]
        if "active" not in user_columns:
            connection.execute(text("ALTER TABLE user_accounts ADD COLUMN active BOOLEAN DEFAULT 1"))
