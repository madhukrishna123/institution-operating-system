from pydantic import BaseModel


class InvoiceCreate(BaseModel):
    student_id: int
    fee_name: str
    amount: int
    paid_amount: int = 0
    status: str = "due"


class InvoiceRead(InvoiceCreate):
    id: int
    student_name: str
    balance: int

