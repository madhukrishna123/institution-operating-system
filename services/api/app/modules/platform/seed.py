from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import hash_password
from app.modules.attendance.models import AttendanceRecord
from app.modules.fees.models import Invoice
from app.modules.platform.models import (
    AgentCapability,
    ApprovalRule,
    ConfigModule,
    Institution,
    MasterDataOption,
    MasterDataSet,
    ModuleField,
    RoleNavigation,
    UserAccount,
    WorkflowDefinition,
    WorkspaceWidget,
)
from app.modules.students.models import Student
from app.settings import settings


ROLES = [
    "super_admin",
    "admin",
    "teacher",
    "student",
    "parent",
    "finance",
    "hr",
]


def seed_platform(db: Session) -> None:
    existing_institution = db.scalar(select(Institution).limit(1))
    if existing_institution:
        ensure_master_data(db)
        if settings.environment == "production":
            ensure_bootstrap_admin(db, existing_institution)
            db.commit()
        else:
            db.commit()
        return

    institution = Institution(name=settings.bootstrap_institution_name, locale="en-IN")
    db.add(institution)
    db.flush()

    is_production = settings.environment == "production"

    student_seed = [] if is_production else [
        ("ADM-001", "Aarav Kumar", "Grade 10", "A", "Meera Kumar"),
        ("ADM-002", "Sara Khan", "Grade 10", "A", "Imran Khan"),
        ("ADM-003", "Nila Reddy", "Grade 9", "B", "Kavya Reddy"),
    ]
    students: list[Student] = []
    for admission_number, full_name, class_name, section, guardian_name in student_seed:
        student = db.scalar(
            select(Student).where(Student.admission_number == admission_number)
        )
        if not student:
            student = Student(
                admission_number=admission_number,
                full_name=full_name,
                class_name=class_name,
                section=section,
                guardian_name=guardian_name,
                status="active",
            )
            db.add(student)
            db.flush()
        students.append(student)

    users = (
        [
            (
                settings.bootstrap_admin_email,
                settings.bootstrap_admin_name,
                "admin",
                None,
                settings.bootstrap_admin_password,
            )
        ]
        if is_production
        else [
            ("super@nova.local", "Super Admin", "super_admin", None, "password"),
            ("admin@nova.local", "Institution Admin", "admin", None, "password"),
            ("teacher@nova.local", "Ananya Teacher", "teacher", None, "password"),
            ("student@nova.local", "Aarav Student", "student", students[0].id, "password"),
            ("parent@nova.local", "Meera Parent", "parent", students[0].id, "password"),
            ("finance@nova.local", "Finance Lead", "finance", None, "password"),
            ("hr@nova.local", "HR Lead", "hr", None, "password"),
        ]
    )
    db.add_all(
        [
            UserAccount(
                institution_id=institution.id,
                email=email,
                name=name,
                role=role,
                password=hash_password(password),
                linked_student_id=student_id,
            )
            for email, name, role, student_id, password in users
        ]
    )
    ensure_master_data(db)

    modules = [
        ("students", "Students", "Identity, guardians, classes, and learner context.", "GraduationCap", "cyan"),
        ("attendance", "Attendance", "Daily marking, risk detection, and interventions.", "ClipboardCheck", "emerald"),
        ("fees", "Fees", "Invoices, balances, dues, and payment follow-up.", "CircleDollarSign", "amber"),
        ("exams", "Exams", "Assessments, marks, grades, and intervention triggers.", "BookOpen", "violet"),
        ("timetable", "Timetable", "Classes, teachers, rooms, and schedule conflicts.", "CalendarDays", "sky"),
        ("staff", "Staff", "Employee records, roles, leave, and duty planning.", "Users", "rose"),
        ("messages", "Messages", "Parent communication, multilingual drafts, and approvals.", "MessageSquareText", "teal"),
        ("analytics", "Analytics", "Operational intelligence and weekly briefs.", "Activity", "blue"),
        ("configuration", "Configuration", "Metadata builder for modules, fields, roles, and workflows.", "Settings", "slate"),
    ]
    db.add_all(
        [
            ConfigModule(
                key=key,
                label=label,
                description=description,
                icon=icon,
                accent=accent,
            )
            for key, label, description, icon, accent in modules
        ]
    )

    fields = {
        "students": [
            ("admission_number", "Admission No.", "text", True, True),
            ("full_name", "Full Name", "text", True, True),
            ("class_name", "Class", "text", True, True),
            ("section", "Section", "text", True, True),
            ("guardian_name", "Guardian", "text", True, True),
            ("status", "Status", "text", True, False),
        ],
        "attendance": [
            ("attendance_date", "Date", "date", True, True),
            ("student_name", "Student", "text", True, False),
            ("status", "Status", "select", True, True),
            ("note", "Note", "text", True, False),
        ],
        "fees": [
            ("student_name", "Student", "text", True, False),
            ("fee_name", "Fee", "text", True, True),
            ("amount", "Amount", "number", True, True),
            ("paid_amount", "Paid", "number", True, False),
            ("balance", "Balance", "number", True, False),
            ("status", "Status", "text", True, False),
        ],
    }
    db.add_all(
        [
            ModuleField(
                module_key=module_key,
                key=key,
                label=label,
                field_type=field_type,
                visible=visible,
                required=required,
                order=index,
            )
            for module_key, module_fields in fields.items()
            for index, (key, label, field_type, visible, required) in enumerate(module_fields)
        ]
    )

    role_modules = {
        "super_admin": ["students", "attendance", "fees", "analytics", "configuration"],
        "admin": ["students", "attendance", "fees", "messages", "analytics", "configuration"],
        "teacher": ["students", "attendance", "exams", "timetable", "messages"],
        "student": ["attendance", "timetable", "exams", "messages"],
        "parent": ["attendance", "fees", "messages"],
        "finance": ["students", "fees", "messages", "analytics"],
        "hr": ["staff", "timetable", "messages", "analytics"],
    }
    db.add_all(
        [
            RoleNavigation(
                role=role,
                module_key=module_key,
                label=next(label for key, label, *_ in modules if key == module_key),
                href=f"/modules/{module_key}",
                order=index,
            )
            for role, module_keys in role_modules.items()
            for index, module_key in enumerate(module_keys)
        ]
    )

    widget_copy = {
        "super_admin": ["System health", "Institution configuration", "Cross-role agent activity"],
        "admin": ["Attendance approvals", "Operational risks", "Configuration changes"],
        "teacher": ["Today's class roster", "Attendance action queue", "Student risk signals"],
        "student": ["My attendance", "My timetable", "Approved notices"],
        "parent": ["Child attendance", "Fee balance", "Approved messages"],
        "finance": ["Outstanding dues", "Payment follow-ups", "Collection trend"],
        "hr": ["Staff availability", "Leave queue", "Duty coverage"],
    }
    db.add_all(
        [
            WorkspaceWidget(
                role=role,
                kind="insight",
                title=title,
                description=f"Role-aware workspace surface for {title.lower()}.",
                order=index,
            )
            for role, titles in widget_copy.items()
            for index, title in enumerate(titles)
        ]
    )

    db.add(
        WorkflowDefinition(
            key="attendance_to_action",
            label="Attendance to Action",
            trigger="attendance_absent_or_late",
            states="submitted, analyzed, recommendation_created, admin_review, approved, rejected, draft_created",
        )
    )
    db.add_all(
        [
            ApprovalRule(workflow_key="attendance_to_action", role="admin", action="approve"),
            ApprovalRule(workflow_key="attendance_to_action", role="admin", action="reject"),
        ]
    )
    db.add_all(
        [
            AgentCapability(agent="Academic Agent", role="teacher", capability="Detect attendance risk and prepare intervention recommendations."),
            AgentCapability(agent="Academic Agent", role="admin", capability="Prioritize attendance interventions for review."),
            AgentCapability(agent="Parent Communication Agent", role="admin", capability="Draft parent-safe multilingual attendance messages."),
            AgentCapability(agent="Finance Agent", role="finance", capability="Draft payment follow-up work from outstanding balances."),
        ]
    )

    if not is_production:
        db.add_all(
            [
                AttendanceRecord(student_id=students[0].id, attendance_date=date(2026, 5, 18), status="present", note=""),
                AttendanceRecord(student_id=students[1].id, attendance_date=date(2026, 5, 18), status="absent", note="No prior notice"),
                Invoice(student_id=students[0].id, fee_name="Term Fee", amount=42000, paid_amount=25000, status="due"),
            ]
        )
    db.commit()


def ensure_bootstrap_admin(db: Session, institution: Institution) -> None:
    admin = db.scalar(select(UserAccount).where(UserAccount.email == settings.bootstrap_admin_email))
    if admin:
        return
    db.add(
        UserAccount(
            institution_id=institution.id,
            email=settings.bootstrap_admin_email,
            name=settings.bootstrap_admin_name,
            role="admin",
            password=hash_password(settings.bootstrap_admin_password),
            linked_student_id=None,
        )
    )


def ensure_master_data(db: Session) -> None:
    sets = [
        ("classes", "Classes", "Class/grade values used in student records."),
        ("sections", "Sections", "Section values used in student records."),
        ("fee_types", "Fee Types", "Fee names used while creating invoices."),
        ("attendance_statuses", "Attendance Statuses", "Allowed attendance status values."),
    ]
    defaults = {
        "classes": ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
        "sections": ["A", "B", "C", "D"],
        "fee_types": ["Admission Fee", "Term Fee", "Transport Fee", "Exam Fee"],
        "attendance_statuses": ["Present", "Absent", "Late"],
    }
    for key, label, description in sets:
        exists = db.scalar(select(MasterDataSet).where(MasterDataSet.key == key))
        if not exists:
            db.add(MasterDataSet(key=key, label=label, description=description))
        existing_values = {
            value
            for value in db.scalars(
                select(MasterDataOption.value).where(MasterDataOption.set_key == key)
            ).all()
        }
        for index, label_value in enumerate(defaults[key]):
            value = label_value.lower().replace(" ", "_")
            if key in ["classes", "sections", "fee_types"]:
                value = label_value
            if key == "attendance_statuses":
                value = label_value.lower()
            if value not in existing_values:
                db.add(
                    MasterDataOption(
                        set_key=key,
                        label=label_value,
                        value=value,
                        order=index,
                        active=True,
                    )
                )
