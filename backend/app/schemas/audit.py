"""Pydantic schemas for audit endpoints."""
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel


class AuditLogItem(BaseModel):
    id: int
    user_id: Optional[int]
    action: str
    entity_type: str
    entity_id: Optional[str]
    details: Optional[dict[str, Any]]
    ip_address: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogItem]
    total: int
    page: int
    page_size: int
