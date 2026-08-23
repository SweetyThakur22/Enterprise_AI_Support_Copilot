"""Pydantic schemas for approval endpoints."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models.approval_request import ApprovalStatus


class ApprovalListItem(BaseModel):
    id: int
    analysis_id: int
    recommendation_index: int
    recommendation_text: str
    risk_level: str
    status: ApprovalStatus
    requested_by: Optional[int]
    requested_at: datetime
    reviewed_at: Optional[datetime]

    model_config = {"from_attributes": True}


class ApprovalDetail(ApprovalListItem):
    reviewed_by: Optional[int]
    review_comment: Optional[str]
    simulated_result: Optional[str]


class ApprovalDecision(BaseModel):
    comment: Optional[str] = Field(None, max_length=2000)


class CreateApprovalRequest(BaseModel):
    analysis_id: int
    recommendation_index: int
    recommendation_text: str
    risk_level: str
