from pydantic import BaseModel, Field
from typing import List, Optional

class EmailInput(BaseModel):
    id: str
    sender: str
    subject: str
    body: str
    date: str
    security_flagged: bool = False
    classification: Optional[str] = None

class CalendarRequest(BaseModel):
    meeting_topic: str
    preferred_time: Optional[str] = None
    attendees: List[str]

class TaskObject(BaseModel):
    id: str
    description: str
    status: str = Field(description="completed, pending, in_progress, waiting_for_approval, scheduled")
    source_email_id: Optional[str] = None

class ApprovalRequest(BaseModel):
    action: str
    details: str
    approved: bool = False

class DailySummaryRequest(BaseModel):
    date: str
    tasks_reviewed: int
