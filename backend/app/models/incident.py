"""Incident model."""
import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class IncidentSeverity(str, enum.Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class IncidentCategory(str, enum.Enum):
    DATABASE = "DATABASE"
    APPLICATION = "APPLICATION"
    NETWORK = "NETWORK"
    API = "API"
    BATCH = "BATCH"
    AUTHENTICATION = "AUTHENTICATION"
    INFRASTRUCTURE = "INFRASTRUCTURE"
    INTEGRATION = "INTEGRATION"
    PERFORMANCE = "PERFORMANCE"


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class IncidentEnvironment(str, enum.Enum):
    DEV = "DEV"
    TEST = "TEST"
    UAT = "UAT"
    PROD = "PROD"
    DR = "DR"


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    incident_id: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    application: Mapped[str] = mapped_column(String(100), nullable=False)
    environment: Mapped[IncidentEnvironment] = mapped_column(Enum(IncidentEnvironment), nullable=False)
    severity: Mapped[IncidentSeverity] = mapped_column(Enum(IncidentSeverity), nullable=False)
    category: Mapped[IncidentCategory] = mapped_column(Enum(IncidentCategory), nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(
        Enum(IncidentStatus), nullable=False, default=IncidentStatus.OPEN
    )
    assigned_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
