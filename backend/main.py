from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import exceptions, dashboard
from config import settings

# Create DB tables
Base.metadata.create_all(bind=engine)

def normalize_name(name: str) -> str:
    if not name:
        return ""
    cleaned = name.lower().replace(".", " ").replace("_", " ")
    return " ".join(cleaned.strip().split())

def normalize_database_records():
    from database import SessionLocal
    from models import DBExceptionRecord, DBAuditLog
    
    db = SessionLocal()
    try:
        # Create all tables first if not already created (just to be safe)
        from database import engine, Base
        Base.metadata.create_all(bind=engine)
        
        # Normalize names, status, and risk_level
        records = db.query(DBExceptionRecord).all()
        updated = False
        for rec in records:
            norm_req = normalize_name(rec.requester)
            norm_appr = normalize_name(rec.approver)
            if rec.requester != norm_req or rec.approver != norm_appr:
                rec.requester = norm_req
                rec.approver = norm_appr
                updated = True
            
            if rec.status:
                norm_status = rec.status.upper().strip()
                if rec.status != norm_status:
                    rec.status = norm_status
                    updated = True
            
            if rec.risk_level:
                norm_risk = rec.risk_level.upper().strip()
                if rec.risk_level != norm_risk:
                    rec.risk_level = norm_risk
                    updated = True
        if updated:
            db.commit()
            print("Successfully normalized database records on startup.")

        # Populate missing audit logs for legacy exceptions
        audit_logged_ids = {log.exception_id for log in db.query(DBAuditLog).all()}
        logged_new = False
        for rec in records:
            if rec.exception_id not in audit_logged_ids:
                # Use start date or default if empty
                log_date_str = rec.start_date.strftime("%Y-%m-%d") if rec.start_date else "2026-06-20"
                timestamp = f"[{log_date_str} 09:00:00]"
                
                db_log = DBAuditLog(
                    timestamp=timestamp,
                    action="IMPORTED",
                    exception_id=rec.exception_id,
                    operator="system.admin",
                    details="Legacy exception record imported retroactively during database alignment."
                )
                db.add(db_log)
                logged_new = True
        if logged_new:
            db.commit()
            print("Successfully backfilled missing audit logs for legacy exceptions.")
    except Exception as e:
        print(f"Error normalising/backfilling database records on startup: {e}")
    finally:
        db.close()

normalize_database_records()

app = FastAPI(title=settings.API_TITLE)

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(exceptions.router)
app.include_router(dashboard.router)

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)