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
