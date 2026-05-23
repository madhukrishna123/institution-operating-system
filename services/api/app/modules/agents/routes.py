from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.modules.attendance.models import AttendanceRecord
from app.modules.fees.models import Invoice
from app.modules.students.models import Student

router = APIRouter()


@router.get("/tasks")
def agent_tasks(db: Session = Depends(get_db)) -> list[dict[str, str | int]]:
    student_count = db.scalar(select(func.count(Student.id))) or 0
    attendance_issues = (
        db.scalar(
            select(func.count(AttendanceRecord.id)).where(
                AttendanceRecord.status.in_(["absent", "late"])
            )
        )
        or 0
    )
    due_amount = (
        db.scalar(select(func.sum(Invoice.amount - Invoice.paid_amount))) or 0
    )

    return [
        {
            "id": "academic-risk-scan",
            "agent": "Academic Agent",
            "title": "Find students needing academic attention",
            "result": f"{attendance_issues} attendance issues found across {student_count} students.",
            "action": "Prepare intervention list",
            "priority": "high" if attendance_issues else "normal",
        },
        {
            "id": "finance-dues-followup",
            "agent": "Finance Agent",
            "title": "Prepare fee follow-up work",
            "result": f"Current unpaid balance is {due_amount}.",
            "action": "Draft payment reminders",
            "priority": "high" if due_amount else "normal",
        },
        {
            "id": "parent-message-draft",
            "agent": "Parent Communication Agent",
            "title": "Draft parent updates",
            "result": "Ready to create multilingual parent notices from attendance and fee data.",
            "action": "Create message drafts",
            "priority": "normal",
        },
        {
            "id": "analytics-weekly-brief",
            "agent": "Analytics Agent",
            "title": "Create weekly operating brief",
            "result": "Can summarize students, attendance, fees, and open follow-ups.",
            "action": "Generate weekly brief",
            "priority": "normal",
        },
    ]


@router.post("/tasks/{task_id}/run")
def run_agent_task(task_id: str) -> dict[str, str]:
    messages = {
        "academic-risk-scan": "Academic Agent prepared an intervention worklist.",
        "finance-dues-followup": "Finance Agent drafted payment reminder copy.",
        "parent-message-draft": "Parent Communication Agent prepared English, Telugu, and Hindi drafts.",
        "analytics-weekly-brief": "Analytics Agent generated a weekly operating brief.",
    }

    return {
        "task_id": task_id,
        "status": "completed",
        "message": messages.get(task_id, "Agent task completed."),
    }

