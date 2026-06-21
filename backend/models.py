from sqlalchemy import Column, String, Date, Integer
from database import Base
from pydantic import BaseModel
from datetime import date
from typing import Optional, List

# --- SQLAlchemy Database Models ---
class DBExceptionRecord(Base):
    __tablename__ = "exceptions"

    exception_id = Column(String, primary_key=True, index=True)
    type = Column(String, index=True)
    requester = Column(String)
    approver = Column(String)
    justification = Column(String)
    start_date = Column(Date)
    end_date = Column(Date, index=True)
    status = Column(String, default="ACTIVE", index=True)
    risk_level = Column(String, default="LOW", index=True)
    renewal_count = Column(Integer, default=0)

class DBAuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(String, index=True)
    action = Column(String)
    exception_id = Column(String, index=True)
    operator = Column(String)
    details = Column(String)

# --- Pydantic API Models ---
class ExceptionBase(BaseModel):
    exception_id: str
    type: str
    requester: str
    approver: str
    justification: str
    start_date: date
    end_date: date
    status: Optional[str] = "ACTIVE"
    risk_level: Optional[str] = "LOW"
    renewal_count: int = 0

class EvaluationResult(BaseModel):
    exception_id: str
    risk_level: str
    alerts: List[str]
    recommendation: str

class PaginatedExceptionsResponse(BaseModel):
    items: List[ExceptionBase]
    total: int
    page: int
    size: int
    pages: int

class AnomalyResponse(BaseModel):
    exception_id: Optional[str] = None
    requester: Optional[str] = None
    anomaly_type: str
    severity: str
    description: str
    date_detected: date

class AuditLogResponse(BaseModel):
    id: int
    timestamp: str
    action: str
    exception_id: str
    operator: str
    details: str

class PaginatedAuditLogsResponse(BaseModel):
    items: List[AuditLogResponse]
    total: int
    page: int
    size: int
    pages: int

class PaginatedAnomaliesResponse(BaseModel):
    items: List[AnomalyResponse]
    total: int
    page: int
    size: int
    pages: int

class RenewalRequest(BaseModel):
    new_end_date: Optional[date] = None
    justification: str
    approved_by: Optional[str] = "system.admin"