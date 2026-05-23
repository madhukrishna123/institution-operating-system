from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.fees.models import Invoice
from app.modules.fees.schemas import InvoiceCreate, InvoiceRead
from app.modules.students.models import Student

router = APIRouter()


@router.get("", response_model=list[InvoiceRead])
def list_invoices(db: Session = Depends(get_db)) -> list[InvoiceRead]:
    rows = db.execute(
        select(Invoice, Student.full_name)
        .join(Student, Student.id == Invoice.student_id)
        .order_by(Invoice.id.desc())
    ).all()

    return [
        InvoiceRead(
            id=invoice.id,
            student_id=invoice.student_id,
            student_name=student_name,
            fee_name=invoice.fee_name,
            amount=invoice.amount,
            paid_amount=invoice.paid_amount,
            status=invoice.status,
            balance=invoice.amount - invoice.paid_amount,
        )
        for invoice, student_name in rows
    ]


@router.post("", response_model=InvoiceRead)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db)) -> InvoiceRead:
    status = "paid" if payload.paid_amount >= payload.amount else payload.status
    invoice = Invoice(**payload.model_dump(exclude={"status"}), status=status)
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    student = db.get(Student, invoice.student_id)

    return InvoiceRead(
        id=invoice.id,
        student_id=invoice.student_id,
        student_name=student.full_name if student else "Unknown student",
        fee_name=invoice.fee_name,
        amount=invoice.amount,
        paid_amount=invoice.paid_amount,
        status=invoice.status,
        balance=invoice.amount - invoice.paid_amount,
    )

