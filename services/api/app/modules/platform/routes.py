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
    ModuleField,
    ModuleFieldOption,
    ModuleRecordValue,
    Notice,
    RoleNavigation,
    UserAccount,
    WorkflowDefinition,
    WorkspaceWidget,
)
from app.modules.platform.schemas import (
    LoginRequest,
    InstitutionUpdate,
    ModuleFieldCreate,
    ModuleFieldUpdate,
    ModuleConfigUpdate,
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
    return user


def field_config(db: Session, module_key: str) -> list[dict]:
    fields = db.scalars(
        select(ModuleField)
        .where(ModuleField.module_key == module_key, ModuleField.visible == True)
        .order_by(ModuleField.order)
    ).all()
    return [
        with_field_options({
            "id": field.id,
            "key": field.key,
            "label": field.label,
            "type": field.field_type,
            "visible": field.visible,
            "required": field.required,
            "order": field.order,
        }) | ({"options": field_options(db, field.id)} if field.field_type == "select" else {})
        for field in fields
    ]


def with_field_options(field: dict) -> dict:
    option_sets = {
        "class_name": [
            {"label": "Grade 8", "value": "Grade 8"},
            {"label": "Grade 9", "value": "Grade 9"},
            {"label": "Grade 10", "value": "Grade 10"},
            {"label": "Grade 11", "value": "Grade 11"},
            {"label": "Grade 12", "value": "Grade 12"},
        ],
        "section": [
            {"label": "A", "value": "A"},
            {"label": "B", "value": "B"},
            {"label": "C", "value": "C"},
            {"label": "D", "value": "D"},
        ],
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


def all_field_config(db: Session, module_key: str) -> list[dict]:
    fields = db.scalars(
        select(ModuleField)
        .where(ModuleField.module_key == module_key)
        .order_by(ModuleField.order)
    ).all()
    return [
        with_field_options({
            "id": field.id,
            "key": field.key,
            "label": field.label,
            "type": field.field_type,
            "visible": field.visible,
            "required": field.required,
            "order": field.order,
        }) | ({"options": field_options(db, field.id)} if field.field_type == "select" else {})
        for field in fields
    ]


def custom_values(db: Session, module_key: str, record_id: int) -> dict[str, str]:
    rows = db.scalars(
        select(ModuleRecordValue).where(
            ModuleRecordValue.module_key == module_key,
            ModuleRecordValue.record_id == record_id,
        )
    ).all()
    return {row.field_key: row.value for row in rows}


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
                "options": [
                    {"label": "Present", "value": "present"},
                    {"label": "Absent", "value": "absent"},
                    {"label": "Late", "value": "late"},
                ],
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
            {"key": "fee_name", "label": "Fee", "type": "text", "required": True},
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
    users = db.scalars(select(UserAccount).order_by(UserAccount.role)).all()
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
    if not user or not verify_password(payload.password, user.password):
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
