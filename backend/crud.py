from sqlalchemy.orm import Session
from models import DBExceptionRecord, ExceptionBase, DBAuditLog
from datetime import datetime

def get_exception_count(db: Session) -> int:
    return db.query(DBExceptionRecord).count()

def get_active_exception_count(db: Session) -> int:
    return db.query(DBExceptionRecord).filter(DBExceptionRecord.status == "ACTIVE").count()

def get_critical_exception_count(db: Session) -> int:
    return db.query(DBExceptionRecord).filter(DBExceptionRecord.risk_level == "CRITICAL").count()

def get_exception_by_id(db: Session, exception_id: str) -> DBExceptionRecord:
    return db.query(DBExceptionRecord).filter(DBExceptionRecord.exception_id == exception_id).first()

def create_or_update_exception(db: Session, record: ExceptionBase) -> DBExceptionRecord:
    exception_id_str = record.exception_id
    existing = get_exception_by_id(db, exception_id_str)
    
    if existing:
        existing.type = record.type
        existing.requester = record.requester
        existing.approver = record.approver
        existing.justification = record.justification
        existing.start_date = record.start_date
        existing.end_date = record.end_date
        existing.status = record.status
        existing.risk_level = record.risk_level
        existing.renewal_count = record.renewal_count
        db_record = existing
    else:
        db_record = DBExceptionRecord(**record.model_dump())
        db.add(db_record)
        
    db.commit()
    db.refresh(db_record)
    return db_record

def get_exceptions(
    db: Session,
    page: int = 1,
    size: int = 10,
    search: str = None,
    status: str = None,
    risk_level: str = None,
    type: str = None,
    sort_by: str = None,
    sort_order: str = "asc"
):
    query = db.query(DBExceptionRecord)
    
    # Filtering
    if status:
        query = query.filter(DBExceptionRecord.status == status)
    if risk_level:
        query = query.filter(DBExceptionRecord.risk_level == risk_level)
    if type:
        query = query.filter(DBExceptionRecord.type == type)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (DBExceptionRecord.requester.ilike(search_filter)) |
            (DBExceptionRecord.approver.ilike(search_filter)) |
            (DBExceptionRecord.justification.ilike(search_filter)) |
            (DBExceptionRecord.exception_id.ilike(search_filter))
        )
        
    # Sorting
    if sort_by:
        if sort_by == "risk_level":
            from sqlalchemy import case, func
            ordering = case(
                {
                    "LOW": 1,
                    "MEDIUM": 2,
                    "HIGH": 3,
                    "CRITICAL": 4
                },
                value=func.upper(DBExceptionRecord.risk_level),
                else_=0
            )
            if sort_order.lower() == "desc":
                query = query.order_by(ordering.desc())
            else:
                query = query.order_by(ordering.asc())
        else:
            column = getattr(DBExceptionRecord, sort_by, None)
            if column is not None:
                if sort_order.lower() == "desc":
                    query = query.order_by(column.desc())
                else:
                    query = query.order_by(column.asc())
    else:
        query = query.order_by(DBExceptionRecord.exception_id.asc())
        
    total = query.count()
    
    # Pagination
    offset = (page - 1) * size
    items = query.offset(offset).limit(size).all()
    
    return items, total

def create_audit_log(db: Session, action: str, exception_id: str, operator: str, details: str) -> DBAuditLog:
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db_log = DBAuditLog(
        timestamp=f"[{timestamp_str}]",
        action=action,
        exception_id=exception_id,
        operator=operator,
        details=details
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_audit_logs_paginated(
    db: Session,
    page: int = 1,
    size: int = 50,
    search: str = None,
    action: str = None
):
    query = db.query(DBAuditLog)
    if action:
        query = query.filter(DBAuditLog.action == action)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (DBAuditLog.exception_id.ilike(search_filter)) |
            (DBAuditLog.operator.ilike(search_filter)) |
            (DBAuditLog.details.ilike(search_filter))
        )
        
    query = query.order_by(DBAuditLog.id.desc())
    total = query.count()
    
    offset = (page - 1) * size
    items = query.offset(offset).limit(size).all()
    
    return items, total
