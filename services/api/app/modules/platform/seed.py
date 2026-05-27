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
    ModuleFieldOption,
    ModuleRecordValue,
    ProfileFieldDefinition,
    ProfileFieldOption,
    ProfileFieldValue,
    RoleProfile,
    RoleNavigation,
    TeacherAssignment,
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
        ensure_core_modules(db)
        ensure_module_fields(db)
        ensure_role_navigation(db)
        ensure_master_data(db)
        ensure_profile_field_metadata(db)
        ensure_role_profiles(db)
        ensure_teacher_assignments(db)
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
    ensure_profile_field_metadata(db)
    ensure_role_profiles(db)
    ensure_teacher_assignments(db)

    db.add_all(
        [
            ConfigModule(
                key=key,
                label=label,
                description=description,
                icon=icon,
                accent=accent,
            )
            for key, label, description, icon, accent in core_modules()
        ]
    )

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
            for module_key, module_fields in core_module_fields().items()
            for index, (key, label, field_type, visible, required) in enumerate(module_fields)
        ]
    )

    db.add_all(
        [
            RoleNavigation(
                role=role,
                module_key=module_key,
                label=next(label for key, label, *_ in core_modules() if key == module_key),
                href=f"/modules/{module_key}",
                order=index,
            )
            for role, module_keys in core_role_modules().items()
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


def core_modules() -> list[tuple[str, str, str, str, str]]:
    return [
        ("classes", "Classes", "Academic years, grades, and active class groups.", "BookOpen", "sky"),
        ("sections", "Sections", "Class sections with capacity, rooms, and class teacher context.", "LayoutDashboard", "teal"),
        ("subjects", "Subjects", "Subjects that can be assigned to teachers and exams.", "BookOpen", "violet"),
        ("section_subjects", "Section Subjects", "Subjects offered for a class section, including teachers and choice type.", "BookOpen", "emerald"),
        ("student_subject_choices", "Student Subject Choices", "Student-level subject choices such as second language or electives.", "GraduationCap", "amber"),
        ("teacher_assignments", "Teacher Assignments", "Multiple class, section, subject, and responsibility assignments for teachers.", "Users", "rose"),
        ("students", "Students", "Identity, guardians, classes, and learner context.", "GraduationCap", "cyan"),
        ("teachers", "Teachers", "Teacher profiles, login access, and class or subject assignments.", "Users", "rose"),
        ("attendance", "Attendance", "Daily marking, risk detection, and interventions.", "ClipboardCheck", "emerald"),
        ("fees", "Fees", "Invoices, balances, dues, and payment follow-up.", "CircleDollarSign", "amber"),
        ("exams", "Exams", "Assessments, schedules, terms, and class applicability.", "CalendarDays", "amber"),
        ("timetable", "Timetable", "Classes, teachers, rooms, and schedule conflicts.", "CalendarDays", "sky"),
        ("staff", "Staff", "Employee records, roles, leave, and duty planning.", "Users", "rose"),
        ("messages", "Messages", "Parent communication, multilingual drafts, and approvals.", "MessageSquareText", "teal"),
        ("analytics", "Analytics", "Operational intelligence and weekly briefs.", "Activity", "blue"),
        ("configuration", "Configuration", "Metadata builder for modules, fields, roles, and workflows.", "Settings", "slate"),
    ]


def core_module_fields() -> dict[str, list[tuple[str, str, str, bool, bool]]]:
    return {
        "classes": [
            ("name", "Class Name", "text", True, True),
            ("academic_year", "Academic Year", "text", True, False),
            ("status", "Status", "text", True, False),
        ],
        "sections": [
            ("class_name", "Class", "select", True, True),
            ("name", "Section Name", "text", True, True),
            ("class_teacher", "Class Teacher", "text", True, False),
            ("room", "Room", "text", True, False),
            ("capacity", "Capacity", "number", True, False),
            ("status", "Status", "text", True, False),
        ],
        "subjects": [
            ("name", "Subject Name", "text", True, True),
            ("code", "Subject Code", "text", True, False),
            ("department", "Department", "text", True, False),
            ("status", "Status", "text", True, False),
        ],
        "section_subjects": [
            ("class_name", "Class", "select", True, True),
            ("section", "Section", "select", True, True),
            ("subject", "Subject", "select", True, True),
            ("teacher", "Teacher", "select", True, False),
            ("subject_type", "Subject Type", "select", True, True),
            ("academic_year", "Academic Year", "text", True, False),
            ("status", "Status", "text", True, False),
        ],
        "student_subject_choices": [
            ("student", "Student", "select", True, True),
            ("subject_type", "Subject Type", "select", True, True),
            ("subject", "Subject", "select", True, True),
            ("academic_year", "Academic Year", "text", True, False),
            ("status", "Status", "text", True, False),
        ],
        "teacher_assignments": [
            ("teacher", "Teacher", "select", True, True),
            ("class_name", "Class", "select", True, True),
            ("section", "Section", "select", True, True),
            ("subject", "Subject", "select", True, False),
            ("assignment_role", "Assignment Role", "select", True, True),
            ("academic_year", "Academic Year", "text", True, False),
            ("status", "Status", "text", True, False),
        ],
        "students": [
            ("admission_number", "Admission No.", "text", True, True),
            ("full_name", "Full Name", "text", True, True),
            ("class_name", "Class", "text", True, True),
            ("section", "Section", "text", True, True),
            ("guardian_name", "Guardian", "text", True, True),
            ("status", "Status", "text", True, False),
        ],
        "teachers": [
            ("name", "Teacher Name", "text", True, True),
            ("email", "Login Email", "text", True, True),
            ("employee_code", "Employee Code", "text", True, False),
            ("department", "Department", "text", True, False),
            ("designation", "Designation", "text", True, False),
            ("subjects", "Subjects", "text", True, False),
            ("assignment_summary", "Assignments", "text", True, False),
            ("active", "Status", "text", True, False),
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
        "exams": [
            ("name", "Exam Name", "text", True, True),
            ("term", "Term", "text", True, False),
            ("class_name", "Class", "select", True, False),
            ("start_date", "Start Date", "date", True, False),
            ("end_date", "End Date", "date", True, False),
            ("status", "Status", "text", True, False),
        ],
    }


def core_role_modules() -> dict[str, list[str]]:
    return {
        "super_admin": ["classes", "sections", "subjects", "section_subjects", "student_subject_choices", "teacher_assignments", "students", "teachers", "attendance", "fees", "exams", "analytics", "configuration"],
        "admin": ["classes", "sections", "subjects", "section_subjects", "student_subject_choices", "teacher_assignments", "students", "teachers", "attendance", "fees", "exams", "messages", "analytics", "configuration"],
        "teacher": ["students", "attendance", "exams", "timetable", "messages"],
        "student": ["attendance", "timetable", "exams", "messages"],
        "parent": ["attendance", "fees", "messages"],
        "finance": ["students", "fees", "messages", "analytics"],
        "hr": ["staff", "timetable", "messages", "analytics"],
    }


def ensure_core_modules(db: Session) -> None:
    for key, label, description, icon, accent in core_modules():
        module = db.scalar(select(ConfigModule).where(ConfigModule.key == key))
        if not module:
            db.add(
                ConfigModule(
                    key=key,
                    label=label,
                    description=description,
                    icon=icon,
                    accent=accent,
                )
            )


def ensure_module_fields(db: Session) -> None:
    for module_key, fields in core_module_fields().items():
        existing_keys = {
            key
            for key in db.scalars(
                select(ModuleField.key).where(ModuleField.module_key == module_key)
            ).all()
        }
        for index, (key, label, field_type, visible, required) in enumerate(fields):
            if key in existing_keys:
                continue
            db.add(
                ModuleField(
                    module_key=module_key,
                    key=key,
                    label=label,
                    field_type=field_type,
                    visible=visible,
                    required=required,
                    order=index,
                )
            )


def ensure_role_navigation(db: Session) -> None:
    module_labels = {key: label for key, label, *_ in core_modules()}
    for role, module_keys in core_role_modules().items():
        existing = {
            row.module_key: row
            for row in db.scalars(
                select(RoleNavigation).where(RoleNavigation.role == role)
            ).all()
        }
        for index, module_key in enumerate(module_keys):
            if module_key in existing:
                existing[module_key].label = module_labels[module_key]
                existing[module_key].href = f"/modules/{module_key}"
                existing[module_key].order = index
                continue
            db.add(
                RoleNavigation(
                    role=role,
                    module_key=module_key,
                    label=module_labels[module_key],
                    href=f"/modules/{module_key}",
                    order=index,
                )
            )


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
        ("subjects", "Subjects", "Subjects used in teacher class assignments."),
        ("subject_types", "Subject Types", "Subject offering categories such as common or second language."),
        ("teacher_assignment_roles", "Teacher Assignment Roles", "Teacher responsibility types."),
    ]
    defaults = {
        "classes": ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"],
        "sections": ["A", "B", "C", "D"],
        "fee_types": ["Admission Fee", "Term Fee", "Transport Fee", "Exam Fee"],
        "attendance_statuses": ["Present", "Absent", "Late"],
        "subjects": ["Maths", "Science", "English", "Social Studies", "Homeroom"],
        "subject_types": ["Common", "Second Language", "Elective"],
        "teacher_assignment_roles": ["Subject Teacher", "Class Teacher", "Coordinator", "Principal Oversight"],
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
            if key in ["classes", "sections", "fee_types", "subjects", "subject_types", "teacher_assignment_roles"]:
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


def ensure_profile_field_metadata(db: Session) -> None:
    core_student_fields = {
        "admission_number",
        "full_name",
        "class_name",
        "section",
        "guardian_name",
        "status",
    }
    legacy_fields = db.scalars(
        select(ModuleField).where(
            ModuleField.module_key == "students",
            ModuleField.key.not_in(core_student_fields),
        )
    ).all()
    for legacy in legacy_fields:
        existing = db.scalar(
            select(ProfileFieldDefinition).where(
                ProfileFieldDefinition.profile_type == "student",
                ProfileFieldDefinition.field_key == legacy.key,
            )
        )
        if not existing:
            field = ProfileFieldDefinition(
                profile_type="student",
                field_key=legacy.key,
                label=legacy.label,
                field_type=legacy.field_type,
                required=legacy.required,
                visible=legacy.visible,
                active=True,
                order=legacy.order,
            )
            db.add(field)
            db.flush()
            options = db.scalars(
                select(ModuleFieldOption)
                .where(ModuleFieldOption.field_id == legacy.id)
                .order_by(ModuleFieldOption.order)
            ).all()
            db.add_all(
                [
                    ProfileFieldOption(
                        field_id=field.id,
                        label=option.label,
                        value=option.value,
                        order=option.order,
                        active=True,
                    )
                    for option in options
                ]
            )
        values = db.scalars(
            select(ModuleRecordValue).where(
                ModuleRecordValue.module_key == "students",
                ModuleRecordValue.field_key == legacy.key,
            )
        ).all()
        for value in values:
            exists = db.scalar(
                select(ProfileFieldValue).where(
                    ProfileFieldValue.profile_type == "student",
                    ProfileFieldValue.profile_id == value.record_id,
                    ProfileFieldValue.field_key == value.field_key,
                )
            )
            if not exists:
                db.add(
                    ProfileFieldValue(
                        profile_type="student",
                        profile_id=value.record_id,
                        field_key=value.field_key,
                        value=value.value,
                    )
                )


def ensure_role_profiles(db: Session) -> None:
    for account in db.scalars(
        select(UserAccount).where(
            UserAccount.role.in_(["teacher", "parent", "staff", "finance", "admin"])
        )
    ).all():
        exists = db.scalar(
            select(RoleProfile).where(
                RoleProfile.user_id == account.id,
                RoleProfile.profile_type == account.role,
            )
        )
        if not exists:
            db.add(
                RoleProfile(
                    user_id=account.id,
                    profile_type=account.role,
                    active=account.active,
                )
            )


def ensure_teacher_assignments(db: Session) -> None:
    teacher = db.scalar(select(UserAccount).where(UserAccount.role == "teacher"))
    if not teacher:
        return
    exists = db.scalar(select(TeacherAssignment).where(TeacherAssignment.teacher_user_id == teacher.id))
    if exists:
        return
    db.add_all(
        [
            TeacherAssignment(
                teacher_user_id=teacher.id,
                class_name="Grade 10",
                section="A",
                subject="Maths",
                assignment_role="Subject Teacher",
                active=True,
            ),
            TeacherAssignment(
                teacher_user_id=teacher.id,
                class_name="Grade 10",
                section="A",
                subject="Homeroom",
                assignment_role="Class Teacher",
                active=True,
            ),
        ]
    )
