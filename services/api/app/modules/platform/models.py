from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(180), unique=True)
    locale: Mapped[str] = mapped_column(String(20), default="en-IN")


class UserAccount(Base):
    __tablename__ = "user_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    institution_id: Mapped[int] = mapped_column(ForeignKey("institutions.id"))
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(40), index=True)
    password: Mapped[str] = mapped_column(String(255), default="password")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    linked_student_id: Mapped[int | None] = mapped_column(Integer, nullable=True)


class ConfigModule(Base):
    __tablename__ = "config_modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    icon: Mapped[str] = mapped_column(String(60), default="LayoutDashboard")
    accent: Mapped[str] = mapped_column(String(30), default="cyan")


class ModuleField(Base):
    __tablename__ = "module_fields"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_key: Mapped[str] = mapped_column(String(80), index=True)
    key: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(120))
    field_type: Mapped[str] = mapped_column(String(40), default="text")
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)


class ModuleFieldOption(Base):
    __tablename__ = "module_field_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("module_fields.id"), index=True)
    label: Mapped[str] = mapped_column(String(120))
    value: Mapped[str] = mapped_column(String(120))
    order: Mapped[int] = mapped_column(Integer, default=0)


class ModuleRecordValue(Base):
    __tablename__ = "module_record_values"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_key: Mapped[str] = mapped_column(String(80), index=True)
    record_id: Mapped[int] = mapped_column(Integer, index=True)
    field_key: Mapped[str] = mapped_column(String(80), index=True)
    value: Mapped[str] = mapped_column(Text, default="")


class ProfileFieldDefinition(Base):
    __tablename__ = "profile_field_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_type: Mapped[str] = mapped_column(String(40), index=True)
    field_key: Mapped[str] = mapped_column(String(80), index=True)
    label: Mapped[str] = mapped_column(String(120))
    field_type: Mapped[str] = mapped_column(String(40), default="text")
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    visible: Mapped[bool] = mapped_column(Boolean, default=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ProfileFieldOption(Base):
    __tablename__ = "profile_field_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    field_id: Mapped[int] = mapped_column(ForeignKey("profile_field_definitions.id"), index=True)
    label: Mapped[str] = mapped_column(String(120))
    value: Mapped[str] = mapped_column(String(120))
    order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ProfileFieldValue(Base):
    __tablename__ = "profile_field_values"

    id: Mapped[int] = mapped_column(primary_key=True)
    profile_type: Mapped[str] = mapped_column(String(40), index=True)
    profile_id: Mapped[int] = mapped_column(Integer, index=True)
    field_key: Mapped[str] = mapped_column(String(80), index=True)
    value: Mapped[str] = mapped_column(Text, default="")


class MasterDataSet(Base):
    __tablename__ = "master_data_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")


class MasterDataOption(Base):
    __tablename__ = "master_data_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    set_key: Mapped[str] = mapped_column(String(80), index=True)
    label: Mapped[str] = mapped_column(String(120))
    value: Mapped[str] = mapped_column(String(120))
    order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class RoleNavigation(Base):
    __tablename__ = "role_navigation"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(40), index=True)
    module_key: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(120))
    href: Mapped[str] = mapped_column(String(160))
    order: Mapped[int] = mapped_column(Integer, default=0)


class WorkspaceWidget(Base):
    __tablename__ = "workspace_widgets"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(40), index=True)
    kind: Mapped[str] = mapped_column(String(60))
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text)
    order: Mapped[int] = mapped_column(Integer, default=0)


class WorkflowDefinition(Base):
    __tablename__ = "workflow_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True)
    label: Mapped[str] = mapped_column(String(140))
    trigger: Mapped[str] = mapped_column(String(120))
    states: Mapped[str] = mapped_column(Text)


class ApprovalRule(Base):
    __tablename__ = "approval_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    workflow_key: Mapped[str] = mapped_column(String(80), index=True)
    role: Mapped[str] = mapped_column(String(40))
    action: Mapped[str] = mapped_column(String(80))


class AgentCapability(Base):
    __tablename__ = "agent_capabilities"

    id: Mapped[int] = mapped_column(primary_key=True)
    agent: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(40))
    capability: Mapped[str] = mapped_column(String(160))


class AgentWorkItem(Base):
    __tablename__ = "agent_work_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(40), index=True)
    agent: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(180))
    source_data: Mapped[str] = mapped_column(Text)
    recommendation: Mapped[str] = mapped_column(Text)
    draft_output: Mapped[str] = mapped_column(Text, default="")
    confidence: Mapped[str] = mapped_column(String(40), default="medium")
    status: Mapped[str] = mapped_column(String(40), default="admin_review")
    audit_trail: Mapped[str] = mapped_column(Text, default="created")


class Notice(Base):
    __tablename__ = "notices"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(Integer, index=True)
    audience: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="visible")
    source_agent_work_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
