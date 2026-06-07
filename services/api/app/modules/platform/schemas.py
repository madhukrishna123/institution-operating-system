from pydantic import BaseModel


class LoginRequest(BaseModel):
    email: str
    password: str = "password"


class ModuleConfigUpdate(BaseModel):
    key: str
    label: str
    description: str
    enabled: bool = True


class ModuleFieldUpdate(BaseModel):
    id: int
    label: str
    visible: bool
    required: bool
    order: int


class ModuleFieldCreate(BaseModel):
    module_key: str
    key: str
    label: str
    field_type: str = "text"
    visible: bool = True
    required: bool = False
    options: list[str] = []


class InstitutionUpdate(BaseModel):
    name: str
    locale: str = "en-IN"


class WorkflowUpdate(BaseModel):
    key: str
    label: str
    trigger: str
    states: str


class RejectRequest(BaseModel):
    reason: str = ""


class AdminUserCreate(BaseModel):
    name: str
    email: str
    role: str
    password: str
    active: bool = True
    linked_student_id: int | None = None


class AdminUserUpdate(BaseModel):
    name: str
    email: str
    role: str
    active: bool = True
    linked_student_id: int | None = None


class PasswordReset(BaseModel):
    password: str


class MasterDataOptionCreate(BaseModel):
    label: str
    value: str = ""
    active: bool = True


class MasterDataOptionUpdate(BaseModel):
    label: str
    value: str
    active: bool = True
    order: int = 0


class ProfileFieldCreate(BaseModel):
    profile_type: str
    field_key: str
    label: str
    field_type: str = "text"
    required: bool = False
    visible: bool = True
    options: list[str] = []


class ProfileFieldUpdate(BaseModel):
    id: int
    label: str
    field_type: str = "text"
    required: bool = False
    visible: bool = True
    order: int = 0
    active: bool = True
    options: list[str] = []


class RoleProfileUpdate(BaseModel):
    employee_code: str = ""
    department: str = ""
    designation: str = ""
    subjects: str = ""
    assigned_class: str = ""
    assigned_section: str = ""
    occupation: str = ""
    relationship_type: str = ""
    preferred_language: str = ""
    contact_email: str = ""
    whatsapp_number: str = ""
    active: bool = True
    custom_values: dict[str, str] = {}


class TeacherAssignmentCreate(BaseModel):
    teacher_user_id: int
    academic_year: str = ""
    class_name: str
    section: str
    subject: str = ""
    assignment_role: str = "Subject Teacher"
    active: bool = True


class TeacherAssignmentUpdate(BaseModel):
    teacher_user_id: int
    academic_year: str = ""
    class_name: str
    section: str
    subject: str = ""
    assignment_role: str = "Subject Teacher"
    active: bool = True
