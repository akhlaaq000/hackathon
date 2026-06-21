import re
from datetime import date, datetime
from typing import List, Dict
from sqlalchemy.orm import Session
from models import DBExceptionRecord

# Current simulation date
T_CURRENT = date(2026, 6, 21)

def normalize_exception_type(t: str) -> str:
    if not t: return "DEV_ENV"
    t_lower = str(t).lower().strip()
    taxonomy_map = {
        "ADMIN_ACCESS": ["admin", "sudo", "privilege", "elevated", "sysadmin", "dba", "superuser", "breakglass", "root", "owner"],
        "ENCRYPTION_WAIVER": ["encrypt", "crypt", "tls", "ssl", "cipher", "certificate", "cert"],
        "FIREWALL_RULE": ["firewall", "port", "network", "acl", "sg", "security group", "ingress", "egress", "vpn", "allowlist", "whitelist"],
        "DATA_ACCESS": ["data", "export", "pii", "phi", "dlp", "download", "query", "read-only"],
        "DEV_ENV": ["dev", "staging", "sandbox", "test", "testing", "uat", "qa", "non-prod", "compliance", "waiver", "vendor"]
    }
    for canonical_type, keywords in taxonomy_map.items():
        if any(keyword in t_lower for keyword in keywords):
            return canonical_type
    return "DEV_ENV"

def normalize_status(s: str) -> str:
    if not s: return "ACTIVE"
    s_upper = s.upper().strip()
    if "PENDING" in s_upper: return "PENDING"
    if s_upper in ["ACTIVE", "EXPIRED", "REVOKED"]: return s_upper
    return "ACTIVE"

TICKET_REGEX = re.compile(r"([A-Z]{2,}-\d{2,}|INC\d{5,}|CHG\d{5,}|REQ\d{5,})", re.IGNORECASE)

VAGUE_KEYWORDS = [
    "business need", "emergency", "legacy issue", "temporary issue",
    "need access", "asap", "tbd", "n/a", "na", "test", "testing", 
    "fix", "broken", "urgent", "quick fix", "pls", "please", "temp",
    "troubleshooting", "maintenance", "support", "update", "patching"
]

def check_vague_justification(justification_str: str) -> (bool, str):
    just = (justification_str or "").strip()
    while just.startswith('>'): just = just[1:].strip()
    just_lower = just.lower()
    
    if bool(TICKET_REGEX.search(just)):
        return False, ""
        
    found_vague = [kw for kw in VAGUE_KEYWORDS if kw in just_lower]
    
    if len(just) < 20:
        return True, f"Justification too short ({len(just)} chars). Minimum 20 required or ITSM ticket."
    elif found_vague and len(just) < 40:
        return True, f"Uses vague term '{found_vague[0]}'. Please provide more context (minimum 40 chars)."
        
    return False, ""

class AnomalyDetector:
    def __init__(self, current_date: date = None):
        self.current_date = current_date or T_CURRENT

    def assess(self, db: Session) -> List[Dict]:
        records = db.query(DBExceptionRecord).all()
        active_counts_per_requester = {}
        
        for rec in records:
            if normalize_status(rec.status) == "ACTIVE" and rec.requester:
                req_norm = rec.requester.lower().strip()
                active_counts_per_requester[req_norm] = active_counts_per_requester.get(req_norm, 0) + 1

        assessed_portfolio = []

        for rec in records:
            exception_alerts = []
            max_severity = "LOW"
            
            def add_alert(alert_type: str, severity: str, desc: str):
                nonlocal max_severity
                exception_alerts.append(f"{alert_type}: {desc}")
                severity_hierarchy = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
                if severity_hierarchy[severity] > severity_hierarchy[max_severity]:
                    max_severity = severity

            type_norm = normalize_exception_type(rec.type)
            status_norm = normalize_status(rec.status)
            stored_risk_level = (rec.risk_level or "LOW").upper().strip()
            
            try:
                renewal_count = int(getattr(rec, 'renewal_count', 0))
            except (TypeError, ValueError):
                renewal_count = 0
            
            start_dt, end_dt = None, None
            is_missing_lifecycle = False
            
            for attr in ['start_date', 'end_date']:
                val = getattr(rec, attr)
                try:
                    if isinstance(val, date): dt = val
                    elif val: dt = datetime.strptime(str(val).strip(), "%Y-%m-%d").date()
                    else: dt = None
                    if attr == 'start_date': start_dt = dt
                    else: end_dt = dt
                except Exception:
                    pass
                
            # FIXED: Data integrity applies to ALL statuses
            if not start_dt or not end_dt:
                add_alert("MISSING_LIFECYCLE", "CRITICAL", "Start or end date is missing/malformed.")
                is_missing_lifecycle = True

            days_active = 0
            
            if not is_missing_lifecycle:
                # FIXED: Data integrity applies to ALL statuses
                if start_dt > end_dt:
                    add_alert("INVALID_DATE_RANGE", "CRITICAL", f"Start Date {start_dt} cannot be after End Date {end_dt}.")
                
                days_active = (self.current_date - start_dt).days
                days_since_expiry = (self.current_date - end_dt).days
                is_expired = days_since_expiry > 0

                # 1. GROUND TRUTH LABELS
                if is_expired and status_norm == "ACTIVE":
                    add_alert("EXPIRED_ACTIVE_EXCEPTION", "CRITICAL", f"End date {end_dt} passed; still marked active")

                if stored_risk_level == "CRITICAL" and status_norm == "ACTIVE":
                    add_alert("CRITICAL_RISK_EXCEPTION", "HIGH", "Exception categorized as critical risk, needs re-review")
 
                if status_norm == "ACTIVE" and days_active > 180 and renewal_count == 0 and stored_risk_level in ["HIGH", "CRITICAL"]:
                    add_alert("LONG_RUNNING_EXCEPTION", "HIGH", f"High/Critical risk ran >180 days without renewal ({days_active} days)")
 
                if type_norm in ["ADMIN_ACCESS", "ENCRYPTION_WAIVER", "DATA_ACCESS"] and status_norm == "ACTIVE" and days_active > 90 and renewal_count == 0:
                    add_alert("HIGH_RISK_LONG_EXCEPTION", "MEDIUM", f"High-risk, active >90 days without review ({days_active} days)")

                if status_norm == "PENDING" and days_active > 30:
                    add_alert("STALLED_REVIEW", "MEDIUM", f"Pending review for >30 days ({days_active} days)")

            # 2. ADVANCED HEURISTICS & EDGE CASES (Active/Pending Only)
            if status_norm in ["ACTIVE", "PENDING"]:
                justification = rec.justification or ""
                is_vague, vague_msg = check_vague_justification(justification)
                if is_vague:
                    add_alert("VAGUE_JUSTIFICATION", "MEDIUM", vague_msg)

                if rec.requester:
                    req_norm = rec.requester.lower().strip()
                    if active_counts_per_requester.get(req_norm, 0) >= 3:
                        add_alert("RISK_ACCUMULATION", "HIGH", f"User holds {active_counts_per_requester[req_norm]} active exceptions.")

                if rec.requester and rec.approver:
                    if rec.requester.lower().strip() == rec.approver.lower().strip():
                        add_alert("SOD_CONFLICT", "CRITICAL", "Requester and Approver are the exact same identity.")

            # 3. SCHEMA COMPILATION
            if exception_alerts:
                recommendation = "Review exception parameters."
                if "EXPIRED_ACTIVE_EXCEPTION" in str(exception_alerts):
                    recommendation = "REVOKE IMMEDIATELY - Expiry exceeded, poses active breach risk."
                elif max_severity == "CRITICAL" or "CRITICAL_RISK_EXCEPTION" in str(exception_alerts):
                    recommendation = "IMMEDIATE REVIEW REQUIRED - Critical access risk detected."
                elif max_severity == "HIGH":
                    recommendation = "REQUEST RENEWAL JUSTIFICATION - Exception has been active too long."
                
                assessed_portfolio.append({
                    "exception_id": rec.exception_id,
                    "risk_level": max_severity,
                    "alerts": exception_alerts,
                    "recommendation": recommendation
                })

        return assessed_portfolio

    def detect(self, db: Session) -> List[Dict]:
        requester_map = {r.exception_id: r.requester for r in db.query(DBExceptionRecord.exception_id, DBExceptionRecord.requester).all() if r.exception_id}
        anomalies = []
        severity_map = {
            "EXPIRED_ACTIVE_EXCEPTION": "CRITICAL",
            "CRITICAL_RISK_EXCEPTION": "HIGH",
            "LONG_RUNNING_EXCEPTION": "HIGH",
            "HIGH_RISK_LONG_EXCEPTION": "MEDIUM",
            "STALLED_REVIEW": "MEDIUM",
            "VAGUE_JUSTIFICATION": "MEDIUM",
            "RISK_ACCUMULATION": "HIGH",
            "SOD_CONFLICT": "CRITICAL",
            "MISSING_LIFECYCLE": "CRITICAL",
            "INVALID_DATE_RANGE": "CRITICAL"
        }
        
        portfolio = self.assess(db)
        for item in portfolio:
            exc_id = item.get("exception_id")
            requester = requester_map.get(exc_id)
            for alert in item.get("alerts", []):
                if ":" in alert:
                    alert_type, desc = alert.split(":", 1)
                    alert_type = alert_type.strip()
                    desc = desc.strip()
                else:
                    alert_type = alert
                    desc = alert
                
                severity = severity_map.get(alert_type, "LOW")
                anomalies.append({
                    "exception_id": exc_id,
                    "requester": requester,
                    "anomaly_type": alert_type,
                    "severity": severity,
                    "description": desc,
                    "date_detected": self.current_date
                })
        return anomalies