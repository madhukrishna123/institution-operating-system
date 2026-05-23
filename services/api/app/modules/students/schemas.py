from pydantic import BaseModel


class StudentBase(BaseModel):
    admission_number: str
    full_name: str
    class_name: str
    section: str
    guardian_name: str
    status: str = "active"


class StudentCreate(StudentBase):
    pass


class StudentRead(StudentBase):
    id: int

    class Config:
        from_attributes = True

