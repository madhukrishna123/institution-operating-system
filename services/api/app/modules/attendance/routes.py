from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.attendance.models import AttendanceRecord
from app.modules.attendance.schemas import AttendanceCreate, AttendanceRead
from app.modules.students.models import Student

router = APIRouter()


@router.get("", response_model=list[AttendanceRead])
def list_attendance(db: Session = Depends(get_db)) -> list[AttendanceRead]:
    rows = db.execute(
        select(AttendanceRecord, Student.full_name)
        .join(Student, Student.id == AttendanceRecord.student_id)
        .order_by(AttendanceRecord.attendance_date.desc(), Student.full_name)
    ).all()

    return [
        AttendanceRead(
            id=record.id,
            student_id=record.student_id,
            student_name=student_name,
            attendance_date=record.attendance_date,
            status=record.status,
            note=record.note,
        )
        for record, student_name in rows
    ]


@router.post("", response_model=AttendanceRead)
def create_attendance(
    payload: AttendanceCreate, db: Session = Depends(get_db)
) -> AttendanceRead:
    record = AttendanceRecord(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    student = db.get(Student, record.student_id)

    return AttendanceRead(
        id=record.id,
        student_id=record.student_id,
        student_name=student.full_name if student else "Unknown student",
        attendance_date=record.attendance_date,
        status=record.status,
        note=record.note,
    )

