from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    hash_password,
    is_hashed_password,
    verify_access_token,
    verify_password,
)
from app.db import get_db
from app.modules.attendance.models import AttendanceRecord
from app.modules.fees.models import Invoice
from app.modules.platform.models import (
    AgentWorkItem,
    ConfigModule,
    Institution,
    MasterDataOption,
    MasterDataSet,
    ModuleField,
    ModuleFieldOption,
    ModuleRecordValue,
    Notice,
    ProfileFieldDefinition,
    ProfileFieldOption,
    ProfileFieldValue,
    RoleProfile,
    RoleNavigation,
    UserAccount,
    WorkflowDefinition,
    WorkspaceWidget,
)
from app.modules.platform.schemas import (
    AdminUserCreate,
    AdminUserUpdate,
    LoginRequest,
    InstitutionUpdate,
    MasterDataOptionCreate,
    MasterDataOptionUpdate,
    ModuleFieldCreate,
    ModuleFieldUpdate,
    ModuleConfigUpdate,
    PasswordReset,
    ProfileFieldCreate,
    ProfileFieldUpdate,
    RoleProfileUpdate,
    RejectRequest,
    WorkflowUpdate,
)
from app.modules.students.models import Student
from app.settings import settings

router = APIRouter()


def token_for(user: UserAccount) -> str:
    return create_access_token(user.id, user.role)


def current_user(
    db: Session = Depends(get_db), authorization: str | None = Header(default=None)
) -> UserAccount:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = authorization.removeprefix("Bearer ").strip()
    if token.startswith("signed:"):
        try:
            payload = verify_access_token(token)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid or expired auth token") from exc
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid or expired auth token")
        user_id = int(payload["sub"])
    elif token.startswith("seed:") and settings.environment != "production":
        try:
            user_id = int(token.removeprefix("seed:").split(":")[0])
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid seeded auth token") from exc
    else:
        raise HTTPException(status_code=401, detail="Invalid auth token")
    user = db.get(UserAccount, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="Unknown user")
    if not user.active:
        raise HTTPException(status_code=401, detail="User is disabled")
    return user


def field_config(db: Session, module_key: str) -> list[dict]:
    query = select(ModuleField).where(ModuleField.module_key == module_key, ModuleField.visible == True)
    if module_key == "students":
        query = query.where(ModuleField.key.in_(CORE_STUDENT_FIELDS))
    fields = db.scalars(query.order_by(ModuleField.order)).all()
    configured_fields = [
        with_field_options(db, {
            "id": field.id,
            "key": field.key,
            "label": field.label,
            "type": field.field_type,
            "visible": field.visible,
            "required": field.required,
            "order": field.order,
            "source": "module",
        }) | ({"options": field_options(db, field.id)} if field.field_type == "select" else {})
        for field in fields
    ]
    if module_key == "students":
        configured_fields.extend(profile_field_config(db, "student"))
    return configured_fields


def with_field_options(db: Session, field: dict) -> dict:
    option_sets = {
        "class_name": master_options(db, "classes"),
        "section": master_options(db, "sections"),
        "status": [
            {"label": "Active", "value": "active"},
            {"label": "Inactive", "value": "inactive"},
            {"label": "Alumni", "value": "alumni"},
        ],
    }
    if field["key"] in option_sets:
        field["type"] = "select"
        field["options"] = option_sets[field["key"]]
    return field


def field_options(db: Session, field_id: int) -> list[dict[str, str]]:
    rows = db.scalars(
        select(ModuleFieldOption)
        .where(ModuleFieldOption.field_id == field_id)
        .order_by(ModuleFieldOption.order)
    ).all()
    return [{"label": row.label, "value": row.value} for row in rows]


def master_options(db: Session, set_key: str) -> list[dict[str, str]]:
    rows = db.scalars(
        select(MasterDataOption)
        .where(MasterDataOption.set_key == set_key, MasterDataOption.active == True)
        .order_by(MasterDataOption.order, MasterDataOption.label)
    ).all()
    return [{"label": row.label, "value": row.value} for row in rows]


PROFILE_TYPES = ["student", "teacher", "parent", "staff", "finance", "admin"]
ROLE_PROFILE_TYPES = ["teacher", "parent", "staff", "finance", "admin"]
CORE_STUDENT_FIELDS = {
    "admission_number",
    "full_name",
    "class_name",
    "section",
    "guardian_name",
    "status",
}


def profile_field_options(db: Session, field_id: int) -> list[dict[str, str]]:
    rows = db.scalars(
        select(ProfileFieldOption)
        .where(ProfileFieldOption.field_id == field_id, ProfileFieldOption.active == True)
        .order_by(ProfileFieldOption.order, ProfileFieldOption.label)
    ).all()
    return [{"label": row.label, "value": row.value} for row in rows]


def profile_field_config(
    db: Session,
    profile_type: str,
    include_inactive: bool = False,
) -> list[dict]:
    query = select(ProfileFieldDefinition).where(ProfileFieldDefinition.profile_type == profile_type)
    if not include_inactive:
        query = query.where(
            ProfileFieldDefinition.active == True,
            ProfileFieldDefinition.visible == True,
        )
    fields = db.scalars(query.order_by(ProfileFieldDefinition.order, ProfileFieldDefinition.label)).all()
    return [
        {
            "id": field.id,
            "key": field.field_key,
            "field_key": field.field_key,
            "label": field.label,
            "type": field.field_type,
            "field_type": field.field_type,
            "required": field.required,
            "visible": field.visible,
            "active": field.active,
            "order": field.order,
            "source": "profile_custom",
            **({"options": profile_field_options(db, field.id)} if field.field_type == "select" else {}),
        }
        for field in fields
    ]


def profile_custom_values(db: Session, profile_type: str, profile_id: int) -> dict[str, str]:
    rows = db.scalars(
        select(ProfileFieldValue).where(
            ProfileFieldValue.profile_type == profile_type,
            ProfileFieldValue.profile_id == profile_id,
        )
    ).all()
    return {row.field_key: row.value for row in rows}


def save_profile_custom_values(
    db: Session,
    profile_type: str,
    profile_id: int,
    values: dict[str, str],
) -> None:
    fields = profile_field_config(db, profile_type, include_inactive=True)
    valid_keys = {field["field_key"] for field in fields}
    for key, raw_value in values.items():
        if key not in valid_keys:
            continue
        value = str(raw_value or "").strip()
        existing = db.scalar(
            select(ProfileFieldValue).where(
                ProfileFieldValue.profile_type == profile_type,
                ProfileFieldValue.profile_id == profile_id,
                ProfileFieldValue.field_key == key,
            )
        )
        if existing:
            existing.value = value
        else:
            db.add(
                ProfileFieldValue(
                    profile_type=profile_type,
                    profile_id=profile_id,
                    field_key=key,
                    value=value,
                )
            )


def all_field_config(db: Session, module_key: str) -> list[dict]:
    query = select(ModuleField).where(ModuleField.module_key == module_key)
    if module_key == "students":
        query = query.where(ModuleField.key.in_(CORE_STUDENT_FIELDS))
    fields = db.scalars(query.order_by(ModuleField.order)).all()
    return [
        with_field_options(db, {
            "id": field.id,
            "key": field.key,
            "label": field.label,
            "type": field.field_type,
            "visible": field.visible,
            "required": field.required,
            "order": field.order,
        }) | ({"options": field_options(db, field.id)} if field.field_type == "select" else {})
        for field in fields
    ] + (profile_field_config(db, "student", include_inactive=True) if module_key == "students" else [])


def custom_values(db: Session, module_key: str, record_id: int) -> dict[str, str]:
    rows = db.scalars(
        select(ModuleRecordValue).where(
            ModuleRecordValue.module_key == module_key,
            ModuleRecordValue.record_id == record_id,
        )
    ).all()
    values = {row.field_key: row.value for row in rows}
    if module_key == "students":
        profile_rows = db.scalars(
            select(ProfileFieldValue).where(
                ProfileFieldValue.profile_type == "student",
                ProfileFieldValue.profile_id == record_id,
            )
        ).all()
        values.update({row.field_key: row.value for row in profile_rows})
    return values


def save_custom_values(
    db: Session,
    module_key: str,
    record_id: int,
    fields: list[dict],
    payload: dict,
) -> None:
    core_student_fields = {
        "admission_number",
        "full_name",
        "class_name",
        "section",
        "guardian_name",
        "status",
    }
    for field in fields:
        key = field["key"]
        if key in core_student_fields:
            continue
        value = str(payload.get(key) or "").strip()
        if module_key == "students" and field.get("source") == "profile_custom":
            existing = db.scalar(
                select(ProfileFieldValue).where(
                    ProfileFieldValue.profile_type == "student",
                    ProfileFieldValue.profile_id == record_id,
                    ProfileFieldValue.field_key == key,
                )
            )
            if existing:
                existing.value = value
            else:
                db.add(
                    ProfileFieldValue(
                        profile_type="student",
                        profile_id=record_id,
                        field_key=key,
                        value=value,
                    )
                )
            continue
        existing = db.scalar(
            select(ModuleRecordValue).where(
                ModuleRecordValue.module_key == module_key,
                ModuleRecordValue.record_id == record_id,
                ModuleRecordValue.field_key == key,
            )
        )
        if existing:
            existing.value = value
        else:
            db.add(
                ModuleRecordValue(
                    module_key=module_key,
                    record_id=record_id,
                    field_key=key,
                    value=value,
                )
            )


def validate_required_fields(fields: list[dict], payload: dict) -> None:
    for field in fields:
        if field.get("required") and not str(payload.get(field["key"]) or "").strip():
            raise HTTPException(status_code=400, detail=f"{field['label']} is required")


def student_options(db: Session) -> list[dict[str, str]]:
    students = db.scalars(select(Student).order_by(Student.full_name)).all()
    return [
        {
            "label": f"{student.full_name} · {student.class_name}",
            "value": str(student.id),
        }
        for student in students
    ]


def create_fields(db: Session, module_key: str) -> list[dict]:
    if module_key == "attendance":
        return [
            {
                "key": "student_id",
                "label": "Student",
                "type": "select",
                "required": True,
                "options": student_options(db),
            },
            {"key": "attendance_date", "label": "Date", "type": "date", "required": True},
            {
                "key": "status",
                "label": "Status",
                "type": "select",
                "required": True,
                "options": master_options(db, "attendance_statuses"),
            },
            {"key": "note", "label": "Note", "type": "text", "required": False},
        ]
    if module_key == "fees":
        return [
            {
                "key": "student_id",
                "label": "Student",
                "type": "select",
                "required": True,
                "options": student_options(db),
            },
            {
                "key": "fee_name",
                "label": "Fee",
                "type": "select",
                "required": True,
                "options": master_options(db, "fee_types"),
            },
            {"key": "amount", "label": "Amount", "type": "number", "required": True},
            {"key": "paid_amount", "label": "Paid", "type": "number", "required": False},
            {
                "key": "status",
                "label": "Status",
                "type": "select",
                "required": False,
                "options": [
                    {"label": "Due", "value": "due"},
                    {"label": "Paid", "value": "paid"},
                ],
            },
        ]
    if module_key == "students":
        return [
            field
            for field in field_config(db, module_key)
        ]
    return []


def can_create_record(module_key: str, role: str) -> bool:
    allowed = {
        "students": role in ["admin", "super_admin"],
        "attendance": role in ["teacher", "admin", "super_admin"],
        "fees": role in ["finance", "admin", "super_admin"],
    }
    return allowed.get(module_key, False)


def ensure_record_permission(module_key: str, role: str, action: str) -> None:
    if not can_create_record(module_key, role):
        labels = {
            "students": "Only admins can manage students",
            "attendance": "Attendance requires teacher/admin role",
            "fees": "Fees require finance/admin role",
        }
        raise HTTPException(status_code=403, detail=labels.get(module_key, f"Cannot {action} this module"))


def create_agent_work_for_attendance(
    db: Session,
    record: AttendanceRecord,
    student: Student | None,
    user: UserAccount,
) -> int | None:
    if record.status not in ["absent", "late"] or not student:
        return None
    existing = db.scalar(
        select(AgentWorkItem).where(AgentWorkItem.source_data == f"attendance_record:{record.id}")
    )
    if existing:
        existing.title = f"Review {student.full_name}'s {record.status} attendance"
        existing.recommendation = f"{student.full_name} was marked {record.status}. Review context and approve parent follow-up if needed."
        existing.draft_output = f"Dear parent, {student.full_name} was marked {record.status} today. Please contact the class teacher if support is needed."
        existing.status = "admin_review"
        existing.audit_trail = f"{existing.audit_trail}; updated by {user.email}; admin_review"
        return existing.id
    work = AgentWorkItem(
        role="admin",
        agent="Academic Agent",
        title=f"Review {student.full_name}'s {record.status} attendance",
        source_data=f"attendance_record:{record.id}",
        recommendation=f"{student.full_name} was marked {record.status}. Review context and approve parent follow-up if needed.",
        draft_output=f"Dear parent, {student.full_name} was marked {record.status} today. Please contact the class teacher if support is needed.",
        confidence="high",
        status="admin_review",
        audit_trail=f"submitted by {user.email}; analyzed; recommendation_created; admin_review",
    )
    db.add(work)
    db.flush()
    return work.id


@router.get("/auth/seed-users")
def seed_users(db: Session = Depends(get_db)) -> list[dict]:
    if settings.environment == "production":
        return []
    users = db.scalars(
        select(UserAccount).where(UserAccount.active == True).order_by(UserAccount.role)
    ).all()
    return [
        {
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "password": "password",
        }
        for user in users
    ]


@router.post("/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(UserAccount).where(UserAccount.email == payload.email))
    if not user or not user.active or not verify_password(payload.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not is_hashed_password(user.password):
        user.password = hash_password(payload.password)
        db.commit()
    return {
        "token": token_for(user),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role,
            "linked_student_id": user.linked_student_id,
        },
        "role": user.role,
        "permissions": ["workspace:read", "records:read", "agents:review"],
        "institution": {"id": user.institution_id, "name": db.get(Institution, user.institution_id).name},
    }


@router.get("/me/workspace")
def workspace(user: UserAccount = Depends(current_user), db: Session = Depends(get_db)) -> dict:
    nav = db.scalars(
        select(RoleNavigation)
        .where(RoleNavigation.role == user.role)
        .order_by(RoleNavigation.order)
    ).all()
    widgets = db.scalars(
        select(WorkspaceWidget)
        .where(WorkspaceWidget.role == user.role)
        .order_by(WorkspaceWidget.order)
    ).all()
    enabled_modules = db.scalars(select(ConfigModule).where(ConfigModule.enabled == True)).all()
    module_map = {module.key: module for module in enabled_modules}
    agent_count = db.scalar(
        select(func.count(AgentWorkItem.id)).where(AgentWorkItem.role.in_([user.role, "admin"]))
    )

    return {
        "user": {"name": user.name, "email": user.email, "role": user.role},
        "institution": {"name": db.get(Institution, user.institution_id).name, "locale": db.get(Institution, user.institution_id).locale},
        "navigation": [
            {
                "label": item.label,
                "href": item.href,
                "module_key": item.module_key,
                "icon": module_map[item.module_key].icon if item.module_key in module_map else "LayoutDashboard",
                "accent": module_map[item.module_key].accent if item.module_key in module_map else "slate",
            }
            for item in nav
            if item.module_key in module_map
        ],
        "widgets": [
            {
                "kind": widget.kind,
                "title": widget.title,
                "description": widget.description,
            }
            for widget in widgets
        ],
        "agent_summary": {
            "pending": agent_count or 0,
            "mode": "recommend_and_draft",
        },
    }


@router.get("/config/modules")
def config_modules(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Configuration requires admin role")
    modules = db.scalars(select(ConfigModule).order_by(ConfigModule.label)).all()
    return [
        {
            "key": module.key,
            "label": module.label,
            "description": module.description,
            "enabled": module.enabled,
            "fields": all_field_config(db, module.key),
        }
        for module in modules
    ]


@router.get("/config/institution")
def get_institution(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Configuration requires admin role")
    institution = db.get(Institution, user.institution_id)
    return {"id": institution.id, "name": institution.name, "locale": institution.locale}


@router.post("/config/institution")
def update_institution(
    payload: InstitutionUpdate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Configuration requires admin role")
    institution = db.get(Institution, user.institution_id)
    institution.name = payload.name.strip() or institution.name
    institution.locale = payload.locale.strip() or "en-IN"
    db.commit()
    return {"status": "saved", "institution": {"id": institution.id, "name": institution.name, "locale": institution.locale}}


def require_admin(user: UserAccount) -> None:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Admin role required")


def serialize_user(user: UserAccount, db: Session) -> dict:
    student = db.get(Student, user.linked_student_id) if user.linked_student_id else None
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "active": user.active,
        "linked_student_id": user.linked_student_id,
        "linked_student_name": student.full_name if student else "",
    }


def validate_admin_user_payload(
    db: Session,
    payload: AdminUserCreate | AdminUserUpdate,
    existing_id: int | None = None,
) -> tuple[str, str, str]:
    name = payload.name.strip()
    email = payload.email.strip().lower()
    role = payload.role.strip()
    allowed_roles = {"super_admin", "admin", "teacher", "student", "parent", "finance", "hr"}
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Unknown role")
    if role in ["student", "parent"] and not payload.linked_student_id:
        raise HTTPException(status_code=400, detail="Student and parent users must be linked to a student")
    if payload.linked_student_id and not db.get(Student, payload.linked_student_id):
        raise HTTPException(status_code=400, detail="Linked student was not found")
    duplicate_query = select(UserAccount).where(UserAccount.email == email)
    if existing_id:
        duplicate_query = duplicate_query.where(UserAccount.id != existing_id)
    if db.scalar(duplicate_query):
        raise HTTPException(
            status_code=409,
            detail="Login email already exists. Use a unique login email and store shared family email in Profiles.",
        )
    return name, email, role


@router.get("/admin/users")
def admin_users(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    require_admin(user)
    rows = db.scalars(select(UserAccount).order_by(UserAccount.role, UserAccount.name)).all()
    return [serialize_user(row, db) for row in rows]


@router.get("/admin/user-options")
def admin_user_options(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    require_admin(user)
    students = db.scalars(select(Student).order_by(Student.full_name)).all()
    return {
        "roles": [
            {"label": "Super Admin", "value": "super_admin"},
            {"label": "Institution Admin", "value": "admin"},
            {"label": "Teacher", "value": "teacher"},
            {"label": "Student", "value": "student"},
            {"label": "Parent", "value": "parent"},
            {"label": "Finance", "value": "finance"},
            {"label": "HR", "value": "hr"},
        ],
        "students": [
            {
                "label": f"{student.full_name} - {student.class_name}-{student.section}",
                "value": student.id,
            }
            for student in students
        ],
    }


def role_profile_type_options() -> list[dict[str, str]]:
    return [
        {"label": "Teacher", "value": "teacher"},
        {"label": "Parent", "value": "parent"},
        {"label": "Staff", "value": "staff"},
        {"label": "Finance", "value": "finance"},
        {"label": "Admin", "value": "admin"},
    ]


def ensure_role_profile(db: Session, user: UserAccount, profile_type: str) -> RoleProfile:
    profile = db.scalar(
        select(RoleProfile).where(
            RoleProfile.user_id == user.id,
            RoleProfile.profile_type == profile_type,
        )
    )
    if profile:
        return profile
    profile = RoleProfile(user_id=user.id, profile_type=profile_type, active=user.active)
    db.add(profile)
    db.flush()
    return profile


def serialize_role_profile(db: Session, profile: RoleProfile, account: UserAccount) -> dict:
    return {
        "id": profile.id,
        "user_id": account.id,
        "user_name": account.name,
        "user_email": account.email,
        "user_active": account.active,
        "profile_type": profile.profile_type,
        "employee_code": profile.employee_code,
        "department": profile.department,
        "designation": profile.designation,
        "subjects": profile.subjects,
        "assigned_class": profile.assigned_class,
        "assigned_section": profile.assigned_section,
        "occupation": profile.occupation,
        "relationship_type": profile.relationship_type,
        "preferred_language": profile.preferred_language,
        "contact_email": profile.contact_email,
        "whatsapp_number": profile.whatsapp_number,
        "active": profile.active,
        "custom_values": profile_custom_values(db, profile.profile_type, profile.id),
        "fields": profile_field_config(db, profile.profile_type),
    }


@router.get("/admin/role-profiles")
def role_profiles(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> dict:
    require_admin(user)
    profile_users = db.scalars(
        select(UserAccount)
        .where(UserAccount.role.in_(ROLE_PROFILE_TYPES))
        .order_by(UserAccount.role, UserAccount.name)
    ).all()
    profiles = []
    for account in profile_users:
        profile = ensure_role_profile(db, account, account.role)
        profiles.append(serialize_role_profile(db, profile, account))
    db.commit()
    return {"profile_types": role_profile_type_options(), "profiles": profiles}


@router.post("/admin/role-profiles/{user_id}/{profile_type}")
def save_role_profile(
    user_id: int,
    profile_type: str,
    payload: RoleProfileUpdate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    if profile_type not in ROLE_PROFILE_TYPES:
        raise HTTPException(status_code=400, detail="Unknown profile type")
    account = db.get(UserAccount, user_id)
    if not account:
        raise HTTPException(status_code=404, detail="User not found")
    if account.role != profile_type:
        raise HTTPException(status_code=400, detail="Profile type must match user role")
    profile = ensure_role_profile(db, account, profile_type)
    profile.employee_code = payload.employee_code.strip()
    profile.department = payload.department.strip()
    profile.designation = payload.designation.strip()
    profile.subjects = payload.subjects.strip()
    profile.assigned_class = payload.assigned_class.strip()
    profile.assigned_section = payload.assigned_section.strip()
    profile.occupation = payload.occupation.strip()
    profile.relationship_type = payload.relationship_type.strip()
    profile.preferred_language = payload.preferred_language.strip()
    profile.contact_email = payload.contact_email.strip().lower()
    profile.whatsapp_number = payload.whatsapp_number.strip()
    profile.active = payload.active
    db.flush()
    save_profile_custom_values(db, profile_type, profile.id, payload.custom_values)
    db.commit()
    return {"status": "saved", "profile": serialize_role_profile(db, profile, account)}


@router.post("/admin/users")
def create_admin_user(
    payload: AdminUserCreate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    name, email, role = validate_admin_user_payload(db, payload)
    row = UserAccount(
        institution_id=user.institution_id,
        name=name,
        email=email,
        role=role,
        password=hash_password(payload.password),
        active=payload.active,
        linked_student_id=payload.linked_student_id if role in ["student", "parent"] else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"status": "created", "user": serialize_user(row, db)}


@router.patch("/admin/users/{user_id}")
def update_admin_user(
    user_id: int,
    payload: AdminUserUpdate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    row = db.get(UserAccount, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    name, email, role = validate_admin_user_payload(db, payload, existing_id=user_id)
    row.name = name
    row.email = email
    row.role = role
    row.active = payload.active
    row.linked_student_id = payload.linked_student_id if role in ["student", "parent"] else None
    db.commit()
    return {"status": "updated", "user": serialize_user(row, db)}


@router.post("/admin/users/{user_id}/reset-password")
def reset_admin_user_password(
    user_id: int,
    payload: PasswordReset,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    row = db.get(UserAccount, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    row.password = hash_password(payload.password)
    db.commit()
    return {"status": "password_reset", "id": user_id}


@router.post("/admin/users/{user_id}/disable")
def disable_admin_user(
    user_id: int,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    row = db.get(UserAccount, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    row.active = False
    db.commit()
    return {"status": "disabled", "id": user_id}


@router.post("/admin/users/{user_id}/enable")
def enable_admin_user(
    user_id: int,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    row = db.get(UserAccount, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    row.active = True
    db.commit()
    return {"status": "enabled", "id": user_id}


def serialize_master_data_option(row: MasterDataOption) -> dict:
    return {
        "id": row.id,
        "label": row.label,
        "value": row.value,
        "order": row.order,
        "active": row.active,
    }


@router.get("/admin/master-data")
def admin_master_data(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    require_admin(user)
    sets = db.scalars(select(MasterDataSet).order_by(MasterDataSet.label)).all()
    return [
        {
            "key": row.key,
            "label": row.label,
            "description": row.description,
            "options": [
                serialize_master_data_option(option)
                for option in db.scalars(
                    select(MasterDataOption)
                    .where(MasterDataOption.set_key == row.key)
                    .order_by(MasterDataOption.order, MasterDataOption.label)
                ).all()
            ],
        }
        for row in sets
    ]


@router.post("/admin/master-data/{set_key}/options")
def create_master_data_option(
    set_key: str,
    payload: MasterDataOptionCreate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    if not db.scalar(select(MasterDataSet).where(MasterDataSet.key == set_key)):
        raise HTTPException(status_code=404, detail="Master data set not found")
    label = payload.label.strip()
    value = (payload.value.strip() or label).lower().replace(" ", "_")
    if set_key in ["classes", "sections", "fee_types"]:
        value = payload.value.strip() or label
    if set_key == "attendance_statuses":
        value = (payload.value.strip() or label).lower()
    if not label:
        raise HTTPException(status_code=400, detail="Option label is required")
    if db.scalar(select(MasterDataOption).where(MasterDataOption.set_key == set_key, MasterDataOption.value == value)):
        raise HTTPException(status_code=409, detail="Option value already exists in this set")
    max_order = db.scalar(select(func.max(MasterDataOption.order)).where(MasterDataOption.set_key == set_key))
    row = MasterDataOption(
        set_key=set_key,
        label=label,
        value=value,
        active=payload.active,
        order=(max_order or 0) + 1,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"status": "created", "option": serialize_master_data_option(row)}


@router.patch("/admin/master-data/{set_key}/options/{option_id}")
def update_master_data_option(
    set_key: str,
    option_id: int,
    payload: MasterDataOptionUpdate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    row = db.get(MasterDataOption, option_id)
    if not row or row.set_key != set_key:
        raise HTTPException(status_code=404, detail="Option not found")
    label = payload.label.strip()
    value = payload.value.strip()
    if not label or not value:
        raise HTTPException(status_code=400, detail="Option label and value are required")
    duplicate = db.scalar(
        select(MasterDataOption).where(
            MasterDataOption.set_key == set_key,
            MasterDataOption.value == value,
            MasterDataOption.id != option_id,
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Option value already exists in this set")
    row.label = label
    row.value = value
    row.active = payload.active
    row.order = payload.order
    db.commit()
    return {"status": "updated", "option": serialize_master_data_option(row)}


@router.delete("/admin/master-data/{set_key}/options/{option_id}")
def delete_master_data_option(
    set_key: str,
    option_id: int,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    row = db.get(MasterDataOption, option_id)
    if not row or row.set_key != set_key:
        raise HTTPException(status_code=404, detail="Option not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted", "id": option_id}


def serialize_profile_field(db: Session, field: ProfileFieldDefinition) -> dict:
    return {
        "id": field.id,
        "profile_type": field.profile_type,
        "field_key": field.field_key,
        "key": field.field_key,
        "label": field.label,
        "field_type": field.field_type,
        "type": field.field_type,
        "required": field.required,
        "visible": field.visible,
        "active": field.active,
        "order": field.order,
        "options": profile_field_options(db, field.id),
    }


@router.get("/config/profile-fields")
def get_profile_fields(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    require_admin(user)
    return [
        {
            "profile_type": profile_type,
            "label": profile_type.replace("_", " ").title(),
            "description": f"Custom fields that appear only on {profile_type} profiles.",
            "fields": [
                serialize_profile_field(db, field)
                for field in db.scalars(
                    select(ProfileFieldDefinition)
                    .where(ProfileFieldDefinition.profile_type == profile_type)
                    .order_by(ProfileFieldDefinition.order, ProfileFieldDefinition.label)
                ).all()
            ],
        }
        for profile_type in PROFILE_TYPES
    ]


@router.post("/config/profile-fields/{profile_type}/fields")
def add_profile_field(
    profile_type: str,
    payload: ProfileFieldCreate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    if profile_type not in PROFILE_TYPES or payload.profile_type != profile_type:
        raise HTTPException(status_code=400, detail="Unknown profile type")
    key = payload.field_key.strip().lower().replace(" ", "_")
    if not key:
        raise HTTPException(status_code=400, detail="Field key is required")
    if db.scalar(
        select(ProfileFieldDefinition).where(
            ProfileFieldDefinition.profile_type == profile_type,
            ProfileFieldDefinition.field_key == key,
        )
    ):
        raise HTTPException(status_code=409, detail="Field key already exists for this profile")
    max_order = db.scalar(
        select(func.max(ProfileFieldDefinition.order)).where(
            ProfileFieldDefinition.profile_type == profile_type
        )
    )
    field = ProfileFieldDefinition(
        profile_type=profile_type,
        field_key=key,
        label=payload.label.strip() or key.replace("_", " ").title(),
        field_type=payload.field_type if payload.field_type in ["text", "number", "date", "select"] else "text",
        required=payload.required,
        visible=payload.visible,
        active=True,
        order=(max_order or 0) + 1,
    )
    db.add(field)
    db.flush()
    if field.field_type == "select":
        db.add_all(
            [
                ProfileFieldOption(
                    field_id=field.id,
                    label=option.strip(),
                    value=option.strip(),
                    order=index,
                    active=True,
                )
                for index, option in enumerate(payload.options)
                if option.strip()
            ]
        )
    db.commit()
    return {"status": "created", "field": serialize_profile_field(db, field)}


@router.post("/config/profile-fields/{profile_type}/fields/update")
def update_profile_fields(
    profile_type: str,
    payload: list[ProfileFieldUpdate],
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    require_admin(user)
    if profile_type not in PROFILE_TYPES:
        raise HTTPException(status_code=400, detail="Unknown profile type")
    fields = {
        field.id: field
        for field in db.scalars(
            select(ProfileFieldDefinition).where(ProfileFieldDefinition.profile_type == profile_type)
        )
    }
    for update in payload:
        field = fields.get(update.id)
        if not field:
            continue
        field.label = update.label.strip() or field.label
        field.field_type = update.field_type if update.field_type in ["text", "number", "date", "select"] else "text"
        field.required = update.required
        field.visible = update.visible
        field.active = update.active
        field.order = update.order
        db.query(ProfileFieldOption).filter(ProfileFieldOption.field_id == field.id).delete()
        if field.field_type == "select":
            db.add_all(
                [
                    ProfileFieldOption(
                        field_id=field.id,
                        label=option.strip(),
                        value=option.strip(),
                        order=index,
                        active=True,
                    )
                    for index, option in enumerate(update.options)
                    if option.strip()
                ]
            )
    db.commit()
    return {"status": "saved", "profile_type": profile_type}


@router.post("/config/modules")
def update_config_module(
    payload: ModuleConfigUpdate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Configuration requires admin role")
    module = db.scalar(select(ConfigModule).where(ConfigModule.key == payload.key))
    if not module:
        module = ConfigModule(key=payload.key, label=payload.label, description=payload.description)
        db.add(module)
    module.label = payload.label
    module.description = payload.description
    module.enabled = payload.enabled
    db.commit()
    return {"status": "saved", "key": module.key}


@router.post("/config/modules/{module_key}/fields")
def update_module_fields(
    module_key: str,
    payload: list[ModuleFieldUpdate],
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Configuration requires admin role")
    fields = {
        field.id: field
        for field in db.scalars(select(ModuleField).where(ModuleField.module_key == module_key))
    }
    for field_update in payload:
        field = fields.get(field_update.id)
        if not field:
            continue
        field.label = field_update.label
        field.visible = field_update.visible
        field.required = field_update.required
        field.order = field_update.order
    db.commit()
    return {"status": "saved", "module_key": module_key}


@router.post("/config/modules/{module_key}/fields/add")
def add_module_field(
    module_key: str,
    payload: ModuleFieldCreate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Configuration requires admin role")
    if module_key != payload.module_key:
        raise HTTPException(status_code=400, detail="Module key mismatch")
    key = payload.key.strip().lower().replace(" ", "_")
    if not key:
        raise HTTPException(status_code=400, detail="Field key is required")
    exists = db.scalar(
        select(ModuleField).where(ModuleField.module_key == module_key, ModuleField.key == key)
    )
    if exists:
        raise HTTPException(status_code=409, detail="Field key already exists")
    max_order = db.scalar(
        select(func.max(ModuleField.order)).where(ModuleField.module_key == module_key)
    )
    field = ModuleField(
        module_key=module_key,
        key=key,
        label=payload.label.strip() or key.replace("_", " ").title(),
        field_type=payload.field_type if payload.field_type in ["text", "number", "date", "select"] else "text",
        visible=payload.visible,
        required=payload.required,
        order=(max_order or 0) + 1,
    )
    db.add(field)
    db.flush()
    if field.field_type == "select":
        options = [option.strip() for option in payload.options if option.strip()]
        db.add_all(
            [
                ModuleFieldOption(
                    field_id=field.id,
                    label=option,
                    value=option,
                    order=index,
                )
                for index, option in enumerate(options)
            ]
        )
    db.commit()
    return {"status": "created", "id": field.id}


@router.get("/config/workflows")
def workflows(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Workflow config requires admin role")
    rows = db.scalars(select(WorkflowDefinition).order_by(WorkflowDefinition.label)).all()
    return [
        {
            "key": row.key,
            "label": row.label,
            "trigger": row.trigger,
            "states": row.states,
        }
        for row in rows
    ]


@router.post("/config/workflows")
def update_workflow(
    payload: WorkflowUpdate,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Workflow config requires admin role")
    workflow = db.scalar(select(WorkflowDefinition).where(WorkflowDefinition.key == payload.key))
    if not workflow:
        workflow = WorkflowDefinition(**payload.model_dump())
        db.add(workflow)
    else:
        workflow.label = payload.label
        workflow.trigger = payload.trigger
        workflow.states = payload.states
    db.commit()
    return {"status": "saved", "key": workflow.key}


@router.get("/modules/{module_key}/records")
def module_records(
    module_key: str,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    fields = field_config(db, module_key)
    module = db.scalar(select(ConfigModule).where(ConfigModule.key == module_key))
    if not module:
        raise HTTPException(status_code=404, detail="Unknown module")
    if not module.enabled:
        raise HTTPException(status_code=404, detail="Module is disabled")

    records: list[dict]
    if module_key == "students":
        query = select(Student).order_by(Student.full_name)
        if user.role in ["student", "parent"] and user.linked_student_id:
            query = query.where(Student.id == user.linked_student_id)
        records = [
            {
                "id": item.id,
                "admission_number": item.admission_number,
                "full_name": item.full_name,
                "class_name": item.class_name,
                "section": item.section,
                "guardian_name": item.guardian_name,
                "status": item.status,
                **custom_values(db, "students", item.id),
            }
            for item in db.scalars(query).all()
        ]
    elif module_key == "attendance":
        rows = db.execute(
            select(AttendanceRecord, Student.full_name)
            .join(Student, Student.id == AttendanceRecord.student_id)
            .order_by(AttendanceRecord.attendance_date.desc())
        ).all()
        records = [
            {
                "id": record.id,
                "student_id": record.student_id,
                "attendance_date": str(record.attendance_date),
                "student_name": student_name,
                "status": record.status,
                "note": record.note,
            }
            for record, student_name in rows
            if user.role not in ["student", "parent"] or record.student_id == user.linked_student_id
        ]
    elif module_key == "fees":
        rows = db.execute(
            select(Invoice, Student.full_name).join(Student, Student.id == Invoice.student_id)
        ).all()
        records = [
            {
                "id": invoice.id,
                "student_id": invoice.student_id,
                "student_name": student_name,
                "fee_name": invoice.fee_name,
                "amount": invoice.amount,
                "paid_amount": invoice.paid_amount,
                "balance": invoice.amount - invoice.paid_amount,
                "status": invoice.status,
            }
            for invoice, student_name in rows
            if user.role not in ["student", "parent"] or invoice.student_id == user.linked_student_id
        ]
    else:
        records = []

    return {
        "module": {
            "key": module.key,
            "label": module.label,
            "description": module.description,
            "accent": module.accent,
        },
        "fields": fields,
        "create_fields": create_fields(db, module_key),
        "records": records,
        "can_create": can_create_record(module_key, user.role),
        "can_edit": can_create_record(module_key, user.role),
        "can_delete": can_create_record(module_key, user.role),
    }


@router.post("/modules/{module_key}/records")
def create_module_record(
    module_key: str,
    payload: dict,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if module_key == "students":
        ensure_record_permission(module_key, user.role, "create")
        student_fields = create_fields(db, "students")
        validate_required_fields(student_fields, payload)
        admission_number = str(payload.get("admission_number") or "").strip()
        if not admission_number:
            raise HTTPException(status_code=400, detail="Admission number is required")
        existing = db.scalar(
            select(Student).where(Student.admission_number == admission_number)
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Student admission number {admission_number} already exists",
            )
        record = Student(
            admission_number=admission_number,
            full_name=str(payload.get("full_name") or "").strip(),
            class_name=str(payload.get("class_name") or "").strip(),
            section=str(payload.get("section") or "").strip(),
            guardian_name=str(payload.get("guardian_name") or "").strip(),
            status=str(payload.get("status") or "active").strip() or "active",
        )
        db.add(record)
        db.flush()
        save_custom_values(db, "students", record.id, student_fields, payload)
        db.commit()
        return {"status": "created", "id": record.id}
    if module_key == "attendance":
        return mark_attendance(payload, user, db)
    if module_key == "fees":
        ensure_record_permission(module_key, user.role, "create")
        validate_required_fields(create_fields(db, "fees"), payload)
        amount = int(payload.get("amount") or 0)
        paid_amount = int(payload.get("paid_amount") or 0)
        status = payload.get("status") or ("paid" if paid_amount >= amount else "due")
        invoice = Invoice(
            student_id=int(payload["student_id"]),
            fee_name=payload["fee_name"],
            amount=amount,
            paid_amount=paid_amount,
            status=status,
        )
        db.add(invoice)
        db.commit()
        return {"status": "created", "id": invoice.id}
    raise HTTPException(status_code=400, detail="Generic create is not enabled for this module yet")


@router.patch("/modules/{module_key}/records/{record_id}")
def update_module_record(
    module_key: str,
    record_id: int,
    payload: dict,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    module = db.scalar(select(ConfigModule).where(ConfigModule.key == module_key))
    if not module or not module.enabled:
        raise HTTPException(status_code=404, detail="Module is disabled or unknown")
    ensure_record_permission(module_key, user.role, "edit")
    if module_key == "students":
        student = db.get(Student, record_id)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        admission_number = str(payload.get("admission_number") or "").strip()
        student_fields = create_fields(db, "students")
        validate_required_fields(student_fields, payload)
        if not admission_number:
            raise HTTPException(status_code=400, detail="Admission number is required")
        duplicate = db.scalar(
            select(Student).where(
                Student.admission_number == admission_number,
                Student.id != record_id,
            )
        )
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail=f"Student admission number {admission_number} already exists",
            )
        student.admission_number = admission_number
        student.full_name = str(payload.get("full_name") or "").strip()
        student.class_name = str(payload.get("class_name") or "").strip()
        student.section = str(payload.get("section") or "").strip()
        student.guardian_name = str(payload.get("guardian_name") or "").strip()
        student.status = str(payload.get("status") or "active").strip() or "active"
        save_custom_values(db, "students", student.id, student_fields, payload)
    elif module_key == "attendance":
        attendance = db.get(AttendanceRecord, record_id)
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        validate_required_fields(create_fields(db, "attendance"), payload)
        attendance.student_id = int(payload["student_id"])
        attendance.attendance_date = date.fromisoformat(str(payload["attendance_date"]))
        attendance.status = str(payload["status"]).strip()
        attendance.note = str(payload.get("note") or "").strip()
        create_agent_work_for_attendance(db, attendance, db.get(Student, attendance.student_id), user)
    elif module_key == "fees":
        invoice = db.get(Invoice, record_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Fee record not found")
        validate_required_fields(create_fields(db, "fees"), payload)
        amount = int(payload.get("amount") or 0)
        paid_amount = int(payload.get("paid_amount") or 0)
        invoice.student_id = int(payload["student_id"])
        invoice.fee_name = str(payload["fee_name"]).strip()
        invoice.amount = amount
        invoice.paid_amount = paid_amount
        invoice.status = str(payload.get("status") or ("paid" if paid_amount >= amount else "due")).strip()
    else:
        raise HTTPException(status_code=400, detail="Update is not enabled for this module yet")
    db.commit()
    return {"status": "updated", "id": record_id}


@router.delete("/modules/{module_key}/records/{record_id}")
def delete_module_record(
    module_key: str,
    record_id: int,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    module = db.scalar(select(ConfigModule).where(ConfigModule.key == module_key))
    if not module or not module.enabled:
        raise HTTPException(status_code=404, detail="Module is disabled or unknown")
    ensure_record_permission(module_key, user.role, "delete")
    if module_key == "students":
        student = db.get(Student, record_id)
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        db.query(ModuleRecordValue).filter(
            ModuleRecordValue.module_key == module_key,
            ModuleRecordValue.record_id == record_id,
        ).delete()
        db.query(ProfileFieldValue).filter(
            ProfileFieldValue.profile_type == "student",
            ProfileFieldValue.profile_id == record_id,
        ).delete()
        attendance_ids = [
            row[0]
            for row in db.execute(select(AttendanceRecord.id).where(AttendanceRecord.student_id == record_id)).all()
        ]
        for attendance_id in attendance_ids:
            db.query(Notice).filter(Notice.student_id == record_id).delete()
            db.query(AgentWorkItem).filter(
                AgentWorkItem.source_data == f"attendance_record:{attendance_id}"
            ).delete()
        db.query(AttendanceRecord).filter(AttendanceRecord.student_id == record_id).delete()
        db.query(Invoice).filter(Invoice.student_id == record_id).delete()
        db.query(UserAccount).filter(UserAccount.linked_student_id == record_id).update(
            {UserAccount.linked_student_id: None}
        )
        db.delete(student)
    elif module_key == "attendance":
        attendance = db.get(AttendanceRecord, record_id)
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        db.query(Notice).filter(
            Notice.source_agent_work_id.in_(
                select(AgentWorkItem.id).where(AgentWorkItem.source_data == f"attendance_record:{record_id}")
            )
        ).delete(synchronize_session=False)
        db.query(AgentWorkItem).filter(
            AgentWorkItem.source_data == f"attendance_record:{record_id}"
        ).delete()
        db.delete(attendance)
    elif module_key == "fees":
        invoice = db.get(Invoice, record_id)
        if not invoice:
            raise HTTPException(status_code=404, detail="Fee record not found")
        db.delete(invoice)
    else:
        raise HTTPException(status_code=400, detail="Delete is not enabled for this module yet")
    db.commit()
    return {"status": "deleted", "id": record_id}


@router.post("/attendance/mark")
def mark_attendance(
    payload: dict,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.role not in ["teacher", "admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Attendance marking requires teacher/admin role")
    record = AttendanceRecord(
        student_id=int(payload["student_id"]),
        attendance_date=date.fromisoformat(payload["attendance_date"]),
        status=payload["status"],
        note=payload.get("note", ""),
    )
    db.add(record)
    db.flush()
    student = db.get(Student, record.student_id)
    agent_work_id = create_agent_work_for_attendance(db, record, student, user)
    db.commit()
    return {"status": "submitted", "attendance_id": record.id, "agent_work_id": agent_work_id}


@router.get("/agent-work")
def agent_work(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    roles = [user.role]
    if user.role in ["admin", "super_admin"]:
        roles.append("admin")
    items = db.scalars(
        select(AgentWorkItem)
        .where(AgentWorkItem.role.in_(roles))
        .order_by(AgentWorkItem.id.desc())
    ).all()
    return [
        {
            "id": item.id,
            "agent": item.agent,
            "title": item.title,
            "source_data": item.source_data,
            "recommendation": item.recommendation,
            "draft_output": item.draft_output,
            "confidence": item.confidence,
            "status": item.status,
            "audit_trail": item.audit_trail,
        }
        for item in items
    ]


@router.post("/agent-work/{item_id}/approve")
def approve_agent_work(
    item_id: int,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Approval requires admin role")
    item = db.get(AgentWorkItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Unknown agent work item")
    item.status = "draft_created"
    item.audit_trail = f"{item.audit_trail}; approved by {user.email}; draft_created"
    if item.source_data.startswith("attendance_record:"):
        record_id = int(item.source_data.split(":", 1)[1])
        attendance = db.get(AttendanceRecord, record_id)
        if attendance:
            for audience in ["student", "parent"]:
                exists = db.scalar(
                    select(Notice).where(
                        Notice.source_agent_work_id == item.id,
                        Notice.audience == audience,
                    )
                )
                if not exists:
                    db.add(
                        Notice(
                            student_id=attendance.student_id,
                            audience=audience,
                            title=item.title,
                            body=item.draft_output,
                            source_agent_work_id=item.id,
                        )
                    )
    db.commit()
    return {"status": item.status, "message": "Approved and parent communication draft is ready."}


@router.post("/agent-work/{item_id}/reject")
def reject_agent_work(
    item_id: int,
    payload: RejectRequest,
    user: UserAccount = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    if user.role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Rejection requires admin role")
    item = db.get(AgentWorkItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Unknown agent work item")
    item.status = "rejected"
    item.audit_trail = f"{item.audit_trail}; rejected by {user.email}; reason={payload.reason}"
    db.commit()
    return {"status": item.status, "message": "Rejected and retained in audit history."}


@router.get("/notices")
def notices(
    user: UserAccount = Depends(current_user), db: Session = Depends(get_db)
) -> list[dict]:
    if user.role not in ["student", "parent"] or not user.linked_student_id:
        return []
    rows = db.scalars(
        select(Notice)
        .where(
            Notice.student_id == user.linked_student_id,
            Notice.audience == user.role,
            Notice.status == "visible",
        )
        .order_by(Notice.id.desc())
    ).all()
    return [
        {
            "id": row.id,
            "title": row.title,
            "body": row.body,
            "status": row.status,
            "source_agent_work_id": row.source_agent_work_id,
        }
        for row in rows
    ]
