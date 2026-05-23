from datetime import date

from pydantic import BaseModel


class AttendanceCreate(BaseModel):
    student_id: int
    attendance_date: date
    status: str
    note: str = ""


class AttendanceRead(AttendanceCreate):
    id: int
    student_name: str

