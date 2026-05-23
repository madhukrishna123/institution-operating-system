from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.students.models import Student
from app.modules.students.schemas import StudentCreate, StudentRead

router = APIRouter()


@router.get("", response_model=list[StudentRead])
def list_students(db: Session = Depends(get_db)) -> list[Student]:
    return list(db.scalars(select(Student).order_by(Student.full_name)))


@router.post("", response_model=StudentRead)
def create_student(payload: StudentCreate, db: Session = Depends(get_db)) -> Student:
    student = Student(**payload.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student
