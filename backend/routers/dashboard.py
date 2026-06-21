from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import AnomalyResponse, DBExceptionRecord, PaginatedAnomaliesResponse, ExceptionBase
from anomaly_detector import AnomalyDetector
from typing import List, Optional
import crud
import math

router = APIRouter(prefix="/api", tags=["dashboard"])

# Global cache for GRC Challenge aggregate report
last_calculated_report = None

def invalidate_report_cache():
    global last_calculated_report
    last_calculated_report = None


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Returns aggregated metrics for the frontend dashboard matching the hierarchical grading schema."""
    from datetime import date, datetime
    from engine import normalize_exception_type, normalize_status
    from models import DBAuditLog
    from sqlalchemy import func
    
    current_date = date(2026, 6, 21)
    
    # Fetch all records
    all_recs = db.query(DBExceptionRecord).all()
    total = len(all_recs)
    
    active_recs = [r for r in all_recs if normalize_status(r.status) == "ACTIVE"]
    active = len(active_recs)
    
    # Calculate risk levels of active exceptions
    critical = 0
    high = 0
    medium = 0
    low = 0
    
    # Counts by category
    admin_root_access = 0
    firewall_rules = 0
    encryption_waivers = 0
    other_types = 0
    
    # Expiry stats
    expiring_this_month = 0
    expired_not_revoked = 0
    
    # Overdue for review (active for > 90 days)
    exceptions_overdue_for_review = 0
    
    # Audit telemetry details
    documented_count = 0
    approved_count = 0
    
    for rec in all_recs:
        # Documented check
        if rec.justification and rec.justification.strip():
            documented_count += 1
            
        # Approval check
        if rec.approver and rec.approver.strip():
            approved_count += 1
            
        status_norm = normalize_status(rec.status)
        type_norm = normalize_exception_type(rec.type)
        risk = (rec.risk_level or "LOW").upper().strip()
        
        # Parse dates
        start_dt, end_dt = None, None
        try:
            if isinstance(rec.start_date, date):
                start_dt = rec.start_date
            elif rec.start_date:
                start_dt = datetime.strptime(str(rec.start_date).strip(), "%Y-%m-%d").date()
        except Exception:
            pass
            
        try:
            if isinstance(rec.end_date, date):
                end_dt = rec.end_date
            elif rec.end_date:
                end_dt = datetime.strptime(str(rec.end_date).strip(), "%Y-%m-%d").date()
        except Exception:
            pass
            
        if status_norm == "ACTIVE":
            if risk == "CRITICAL":
                critical += 1
            elif risk == "HIGH":
                high += 1
            elif risk == "MEDIUM":
                medium += 1
            elif risk == "LOW":
                low += 1
                
            # Type breakdown
            if type_norm == "ADMIN_ACCESS":
                admin_root_access += 1
            elif type_norm == "FIREWALL_RULE":
                firewall_rules += 1
            elif type_norm == "ENCRYPTION_WAIVER":
                encryption_waivers += 1
            else:
                other_types += 1
                
            # Expiry checks
            if end_dt:
                # Expired not revoked
                if end_dt < current_date:
                    expired_not_revoked += 1
                # Expiring this month (June 2026)
                elif end_dt.year == 2026 and end_dt.month == 6:
                    expiring_this_month += 1
                    
            # Overdue for review (running for > 90 days)
            if start_dt:
                days_active = (current_date - start_dt).days
                if days_active > 90:
                    exceptions_overdue_for_review += 1

    critical_or_high = critical + high
    
    # Calculate active anomalies
    detector = AnomalyDetector()
    anomalies = detector.detect(db)
    active_anomalies = len(anomalies)

    # Calculate renewals and actions
    total_renewals = db.query(func.sum(DBExceptionRecord.renewal_count)).scalar() or 0
    total_actions = db.query(DBAuditLog).count()
    
    # Get time range of the exceptions
    min_start = db.query(func.min(DBExceptionRecord.start_date)).scalar()
    max_end = db.query(func.max(DBExceptionRecord.end_date)).scalar()
    if min_start and max_end:
        time_range = f"{min_start} to {max_end}"
    else:
        time_range = "2026-01-15 to 2026-04-15"
        
    # Top high risk exceptions & recommendations
    high_risk_active = [r for r in all_recs if normalize_status(r.status) == "ACTIVE" and (r.risk_level or "LOW").upper().strip() in ["CRITICAL", "HIGH"]]
    # Sort by active duration descending
    def get_duration_days(r):
        try:
            if isinstance(r.start_date, date):
                return (current_date - r.start_date).days
            elif r.start_date:
                dt = datetime.strptime(str(r.start_date).strip(), "%Y-%m-%d").date()
                return (current_date - dt).days
        except Exception:
            pass
        return 0
        
    high_risk_active.sort(key=get_duration_days, reverse=True)
    
    top_high_risk = []
    recommendations = []
    
    for idx, rec in enumerate(high_risk_active[:5], 1):
        days = get_duration_days(rec)
        months = days // 30
        
        # Clean justification for display
        desc = (rec.justification or "").replace("\n", " ").strip()
        if not desc:
            desc = f"{rec.type} access waiver"
        if len(desc) > 30:
            desc = desc[:30] + "..."
            
        if rec.renewal_count == 0 and days > 90:
            duration_str = f"No renewal in {days} days"
        elif months > 0:
            duration_str = f"{months} MONTHS OLD"
        else:
            duration_str = f"{days} DAYS OLD"
            
        top_high_risk.append(f"{idx}. {rec.exception_id} {desc} – {duration_str}")
        recommendations.append(f"Audit justification and re-verify approval authorization for {rec.exception_id} ({desc})")
        
    # Add a fallback recommendation if empty
    if not recommendations:
        recommendations.append("All high-priority exceptions are within compliant parameters.")
        
    # Audit telemetry percentage
    all_exceptions_documented = (documented_count == total) if total > 0 else True
    approvals_recorded_percentage = int((approved_count / total) * 100) if total > 0 else 100

    return {
        "report_date": current_date.strftime("%Y-%m-%d"),
        "time_range": time_range,
        "executive_summary": {
            "total_active_exceptions": active,
            "high_risk": critical_or_high,
            "medium_risk": medium,
            "low_risk": low,
            "expiring_this_month": expiring_this_month,
            "expired_not_revoked": expired_not_revoked
        },
        "breakdown_by_type": {
            "admin_root_access": admin_root_access,
            "firewall_rules": firewall_rules,
            "encryption_waivers": encryption_waivers,
            "other": other_types
        },
        "top_high_risk_exceptions": top_high_risk,
        "recommendations": recommendations,
        "next_audit_readiness": {
            "all_exceptions_documented": all_exceptions_documented,
            "approvals_recorded_percentage": approvals_recorded_percentage,
            "exceptions_overdue_for_review": exceptions_overdue_for_review,
            "exceptions_not_revoked_after_expiry": expired_not_revoked
        }
    }

@router.get("/anomalies", response_model=PaginatedAnomaliesResponse)
def get_detected_anomalies(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Runs the anomaly engine and returns all detected exceptions anomalies paginated."""
    detector = AnomalyDetector()
    all_anomalies = detector.detect(db)
    
    # Filter anomalies in memory
    filtered = all_anomalies
    if severity:
        filtered = [a for a in filtered if a["severity"].upper() == severity.upper()]
    if search:
        search_lower = search.lower()
        filtered = [
            a for a in filtered
            if (a.get("exception_id") and search_lower in a["exception_id"].lower()) or
               (a.get("requester") and search_lower in a["requester"].lower()) or
               search_lower in a["anomaly_type"].lower() or
               search_lower in a["description"].lower()
        ]
        
    # Sort by severity priority: CRITICAL -> HIGH -> MEDIUM -> LOW
    severity_priority = {"CRITICAL": 1, "HIGH": 2, "MEDIUM": 3, "LOW": 4}
    filtered.sort(key=lambda a: severity_priority.get(a["severity"].upper(), 99))

    total = len(filtered)
    offset = (page - 1) * size
    items = filtered[offset : offset + size]
    pages = math.ceil(total / size) if total > 0 else 0
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

@router.get("/dashboard/insights")
def get_portfolio_insights(db: Session = Depends(get_db)):
    """Compiles portfolio insights (approver distribution & risk heatmap matrix)."""
    from engine import normalize_exception_type
    
    # Fetch all active exceptions
    active_recs = db.query(DBExceptionRecord).filter(DBExceptionRecord.status == "ACTIVE").all()
    
    # 1. Approver distribution: { approver_norm: { "CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0 } }
    approver_dist = {}
    approver_display_names = {}
    
    # 2. Risk vs Type Heatmap Matrix: { type: { "CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0 } }
    type_dist = {
        "ADMIN_ACCESS": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "DATA_ACCESS": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "ENCRYPTION_WAIVER": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "FIREWALL_RULE": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "DEV_ENV": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
    }
    
    for rec in active_recs:
        appr_raw = rec.approver or "Unknown"
        appr_norm = " ".join(appr_raw.lower().replace(".", " ").replace("_", " ").split())
        
        etype = normalize_exception_type(rec.type)
        risk = (rec.risk_level or "LOW").upper()
        
        # Save display name preference: prefer one that is not fully lowercase or has spaces
        if appr_norm not in approver_display_names:
            approver_display_names[appr_norm] = appr_raw
        elif appr_raw != appr_norm and not approver_display_names[appr_norm].istitle():
            approver_display_names[appr_norm] = appr_raw
            
        # Approver distribution
        if appr_norm not in approver_dist:
            approver_dist[appr_norm] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        if risk in approver_dist[appr_norm]:
            approver_dist[appr_norm][risk] += 1
            
        # Type heatmap matrix
        if etype not in type_dist:
            type_dist[etype] = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        if risk in type_dist[etype]:
            type_dist[etype][risk] += 1
            
    # Format for easy frontend consumption
    approver_data = []
    for appr_norm, counts in approver_dist.items():
        display_name = approver_display_names.get(appr_norm, appr_norm)
        if display_name.islower():
            display_name = display_name.title()
        approver_data.append({
            "approver": display_name,
            "counts": counts,
            "total": sum(counts.values())
        })
    # Sort by total descending
    approver_data.sort(key=lambda x: x["total"], reverse=True)
    
    heatmap_data = []
    for etype, counts in type_dist.items():
        heatmap_data.append({
            "type": etype,
            "counts": counts,
            "total": sum(counts.values())
        })
        
    # Exception Creep / Trend analysis (historical progression)
    all_recs = db.query(DBExceptionRecord).all()
    monthly_data = {}
    for rec in all_recs:
        if rec.start_date:
            month_key = rec.start_date.strftime("%Y-%m")
            monthly_data[month_key] = monthly_data.get(month_key, 0) + 1
            
    sorted_months = sorted(monthly_data.keys())
    trend_data = []
    cumulative = 0
    for month in sorted_months:
        count = monthly_data[month]
        cumulative += count
        trend_data.append({
            "month": month,
            "created": count,
            "cumulative": cumulative
        })
        
    return {
        "approver_distribution": approver_data,
        "heatmap": heatmap_data,
        "trend": trend_data
    }


@router.get("/reports/aggregate")
def get_aggregate_audit_report(db: Session = Depends(get_db)):
    """Compiles the aggregate portfolio audit report JSON matching the GRC Challenge schema."""
    global last_calculated_report
    if last_calculated_report is not None:
        return last_calculated_report
        
    from datetime import date
    from engine import RiskEngine, normalize_exception_type, normalize_status
    
    current_date = date(2026, 6, 21)
    
    # 1. Query exceptions
    all_recs = db.query(DBExceptionRecord).all()
    
    # Pre-calculate active exception counts per requester to keep evaluation O(N)
    active_recs = [r for r in all_recs if normalize_status(r.status) == "ACTIVE"]
    requester_counts = {}
    for rec in active_recs:
        if rec.requester:
            req_norm = " ".join(rec.requester.lower().replace(".", " ").replace("_", " ").split())
            requester_counts[req_norm] = requester_counts.get(req_norm, 0) + 1
            
    risk_engine = RiskEngine(current_date=current_date)
    
    # Calculate record-level dynamic evaluations
    active_count = 0
    risk_breakdown = {"HIGH": 0, "MEDIUM": 0, "LOW": 0}
    critical_count = 0
    
    type_breakdown = {
        "ADMIN_ACCESS": 0,
        "FIREWALL_RULES": 0,
        "ENCRYPTION_WAIVERS": 0,
        "OTHER": 0
    }
    
    top_high_risk_exceptions = []
    
    for rec in all_recs:
        # Construct ExceptionBase from DB record
        record_base = ExceptionBase(
            exception_id=rec.exception_id or "UNKNOWN",
            type=rec.type or "",
            requester=rec.requester or "",
            approver=rec.approver or "",
            justification=rec.justification or "",
            start_date=rec.start_date,
            end_date=rec.end_date,
            status=rec.status or "ACTIVE",
            risk_level=rec.risk_level or "LOW",
            renewal_count=rec.renewal_count or 0
        )
        
        eval_res = risk_engine.evaluate(record_base, requester_counts=requester_counts)
        
        status_norm = normalize_status(rec.status)
        type_norm = normalize_exception_type(rec.type)
        
        # Aggregate statistics based on evaluated values
        if status_norm == "ACTIVE":
            active_count += 1
            if eval_res.risk_level == "CRITICAL":
                critical_count += 1
            elif eval_res.risk_level in risk_breakdown:
                risk_breakdown[eval_res.risk_level] += 1
                
            # Type breakdown counts for ACTIVE exceptions
            if type_norm == "ADMIN_ACCESS":
                type_breakdown["ADMIN_ACCESS"] += 1
            elif type_norm == "FIREWALL_RULE":
                type_breakdown["FIREWALL_RULES"] += 1
            elif type_norm == "ENCRYPTION_WAIVER":
                type_breakdown["ENCRYPTION_WAIVERS"] += 1
            else:
                type_breakdown["OTHER"] += 1
                
        # Collect for top high risk exceptions list
        if eval_res.risk_level in ["CRITICAL", "HIGH"]:
            duration_months = 0
            if rec.start_date:
                duration_months = max(0, (current_date - rec.start_date).days) // 30
            top_high_risk_exceptions.append({
                "exception_id": rec.exception_id or "UNKNOWN",
                "issue": type_norm,
                "duration_months": duration_months
            })
            
    # Sort top high risk by duration descending, take top 10
    top_high_risk_exceptions.sort(key=lambda x: x["duration_months"], reverse=True)
    top_high_risk_exceptions = top_high_risk_exceptions[:10]
    
    report = {
        "report_date": current_date.strftime("%Y-%m-%d"),
        "executive_summary": {
            "total_active_exceptions": active_count,
            "risk_breakdown": risk_breakdown,
            "critical_exceptions_found": critical_count
        },
        "type_breakdown": type_breakdown,
        "top_high_risk_exceptions": top_high_risk_exceptions
    }
    
    last_calculated_report = report
    return report


