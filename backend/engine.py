import math
import re
from datetime import date, datetime
from sqlalchemy.orm import Session
from models import ExceptionBase, EvaluationResult
from typing import List, Dict, Optional

T_CURRENT = date(2026, 6, 21)

# Config-Driven mappings for Risk Scoring Engine
BASE_WEIGHT_MAPPING = {
    "ADMIN_ACCESS": 5.0,
    "FIREWALL_RULE": 2.5,
    "ENCRYPTION_WAIVER": 4.0,
    "DATA_ACCESS": 4.0,
    "DEV_ENV": 1.0,
}

RISK_THRESHOLD_MAPPING = [
    (8.5, "CRITICAL"),
    (5.0, "HIGH"),
    (2.5, "MEDIUM"),
    (0.0, "LOW"),
]

def normalize_exception_type(t: str) -> str:
    """
    Normalizes raw, unstructured exception types into canonical GRC categories
    using industry-standard SecOps and IAM keyword taxonomies (5 uppercase strings).
    """
    if not t:
        return "DEV_ENV"
        
    t_lower = str(t).lower().strip()
    
    # Priority-ordered mapping to the 5 exact uppercase GRC categories
    taxonomy_map = {
        "ADMIN_ACCESS": ["admin", "sudo", "privilege", "elevated", "sysadmin", "dba", "superuser", "breakglass", "break glass", "sa account", "god mode", "local admin", "root", "owner"],
        "ENCRYPTION_WAIVER": ["encrypt", "crypt", "tls", "ssl", "cipher", "certificate", "cert"],
        "FIREWALL_RULE": ["firewall", "port", "network", "acl", "sg", "security group", "ingress", "egress", "vpn", "allowlist", "whitelist", "waf", "proxy", "routing", "ips", "ids"],
        "DATA_ACCESS": ["data", "export", "pii", "phi", "dlp", "download", "query", "read-only", "sql access"],
        "DEV_ENV": ["dev", "staging", "sandbox", "test", "testing", "uat", "qa", "non-prod", "nonprod", "poc", "local", "experimental", "compliance", "policy waiver", "mfa", "2fa", "otp", "pci", "soc2", "gdpr", "ccpa", "hipaa", "auth bypass", "cleartext", "vendor access", "vendor", "third party"]
    }
    
    for canonical_type, keywords in taxonomy_map.items():
        if any(keyword in t_lower for keyword in keywords):
            return canonical_type
            
    return "DEV_ENV"


def normalize_status(s: str) -> str:
    if not s:
        return "ACTIVE"
    s_upper = s.upper().strip()
    if "PENDING" in s_upper:
        return "PENDING"
    if s_upper in ["ACTIVE", "EXPIRED", "REVOKED"]:
        return s_upper
    return "ACTIVE"

class RiskEngine:
    def __init__(self, current_date: date = None):
        self.current_date = current_date or T_CURRENT

    def evaluate(self, record: ExceptionBase, db: Session = None, requester_counts: dict = None) -> EvaluationResult:
        alerts = []
        recommendation = "Maintain standard monitoring."
        current_risk = "LOW"
        
        # Normalize type and status
        type_norm = normalize_exception_type(record.type)
        status_norm = normalize_status(record.status)
        
        # 1. Visibility Check
        is_missing_visibility = False
        if not record.exception_id or not record.requester or not record.approver:
            alerts.append("MISSING_VISIBILITY_DATA: Missing visibility details (ID, Requester, or Approver)")
            current_risk = "CRITICAL"
            is_missing_visibility = True
            
        # Parse Dates & Lifecycle Check
        start_dt = None
        end_dt = None
        is_missing_lifecycle = False
        
        try:
            if isinstance(record.start_date, date):
                start_dt = record.start_date
            elif record.start_date:
                start_dt = datetime.strptime(str(record.start_date).strip(), "%Y-%m-%d").date()
        except Exception:
            pass
            
        try:
            if isinstance(record.end_date, date):
                end_dt = record.end_date
            elif record.end_date:
                end_dt = datetime.strptime(str(record.end_date).strip(), "%Y-%m-%d").date()
        except Exception:
            pass
            
        if not start_dt or not end_dt:
            alerts.append("MISSING_LIFECYCLE_DATA: End date is null, missing, or malformed")
            current_risk = "CRITICAL"
            is_missing_lifecycle = True
            
        # If dates are valid, check durations
        days_active = 0
        days_since_expiry = 0
        is_expired = False
        
        if not is_missing_lifecycle:
            if start_dt > end_dt:
                alerts.append("INVALID_DATE_RANGE: Start Date is after End Date")
                current_risk = "CRITICAL"
                recommendation = "REVOKE IMMEDIATELY - Invalid date range configuration."
            days_active = (self.current_date - start_dt).days
            days_since_expiry = (self.current_date - end_dt).days
            is_expired = days_since_expiry > 0
            
            # Risk Scoring calculation based on Type + Duration + Status
            base_weight = BASE_WEIGHT_MAPPING.get(type_norm, 1.0)
            days_active_val = max(0, days_active)
            temporal_risk = math.log10(days_active_val + 1) * 0.5
            compliance_multiplier = 2.0 if (status_norm == "ACTIVE" and is_expired) else 1.0
            
            risk_score = min(10.0, (base_weight + temporal_risk) * compliance_multiplier)
            
            # Map dynamic risk score to risk level
            dynamic_risk_level = "LOW"
            for threshold, level in RISK_THRESHOLD_MAPPING:
                if risk_score >= threshold:
                    dynamic_risk_level = level
                    break
            
            if not is_missing_visibility:
                current_risk = dynamic_risk_level
            
            # Expiry Alerts: System triggers if end_date is <= 7 days from current_date (and not already expired/inactive)
            if status_norm == "ACTIVE" and not is_expired:
                days_until_expiry = (end_dt - self.current_date).days
                if 0 <= days_until_expiry <= 7:
                    alerts.append(f"EXPIRING_SOON: Exception will expire in {days_until_expiry} days")
        
        # Rule 1: EXPIRED_ACTIVE_EXCEPTION (Critical)
        if not is_missing_lifecycle:
            if is_expired and status_norm == "ACTIVE":
                alerts.append("EXPIRED_NOT_REVOKED: End date passed; still marked active")
                current_risk = "CRITICAL"
                recommendation = "REVOKE IMMEDIATELY - Expiry exceeded; poses breach risk."
                
        # Rule 2: LONG_RUNNING_EXCEPTION (High)
        if not is_missing_lifecycle:
            if status_norm == "ACTIVE" and days_active > 180:
                alerts.append("LONG_RUNNING_EXCEPTION: Active for >180 days")
                if current_risk != "CRITICAL":
                    current_risk = "HIGH"
                    
        # Rule 3: CRITICAL_RISK_EXCEPTION (Critical)
        if (record.risk_level and record.risk_level.upper().strip() == "CRITICAL") or type_norm == "ADMIN_ACCESS":
            alerts.append("ELEVATED_PRIVILEGE: Admin access requires immediate re-review")
            current_risk = "CRITICAL"
            
        # Rule 4: HIGH_RISK_LONG_EXCEPTION (High)
        if not is_missing_lifecycle:
            if type_norm in ["ADMIN_ACCESS", "ENCRYPTION_WAIVER", "DATA_ACCESS"] and days_active > 90:
                alerts.append("ELEVATED_PRIVILEGE_PROLONGED: High-risk type has been running for > 90 days")
                if current_risk != "CRITICAL":
                    current_risk = "HIGH"
                    
        # Rule 5: STALLED_REVIEW (Medium)
        if not is_missing_lifecycle:
            if status_norm in ["PEND", "PENDING"] and days_active > 30:
                alerts.append("STALLED_REVIEW: Exception has remained pending review for > 30 days")
                if current_risk not in ["CRITICAL", "HIGH"]:
                    current_risk = "MEDIUM"
                    
        # Rule 6: VAGUE_JUSTIFICATION (Risk Floor & Tier Escalation)
        from anomaly_detector import check_vague_justification
        is_vague, vague_msg = check_vague_justification(record.justification)
        if is_vague:
            alerts.append(f"VAGUE_JUSTIFICATION: {vague_msg}")
            recommendation = "Re-submit with a specific technical remediation plan."
            
            # Escalate the dynamically evaluated risk level by 1 tier
            risk_hierarchy = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
            if current_risk in risk_hierarchy:
                idx = risk_hierarchy.index(current_risk)
                if idx < len(risk_hierarchy) - 1:
                    current_risk = risk_hierarchy[idx + 1]
                
        # Rule 7: RISK_ACCUMULATION (Risk Aggregation)
        active_count = 0
        if requester_counts is not None and record.requester:
            req_norm = " ".join(record.requester.lower().replace(".", " ").replace("_", " ").split())
            active_count = requester_counts.get(req_norm, 0)
        elif db and record.requester:
            from models import DBExceptionRecord
            req_norm = " ".join(record.requester.lower().replace(".", " ").replace("_", " ").split())
            active_recs = db.query(DBExceptionRecord).filter(DBExceptionRecord.status == "ACTIVE").all()
            for r in active_recs:
                r_norm = " ".join((r.requester or "").lower().replace(".", " ").replace("_", " ").split())
                if r_norm == req_norm:
                    active_count += 1
                    
        if active_count >= 3:
            alerts.append(f"RISK_ACCUMULATION: Requester holds {active_count} active exceptions simultaneously (limit is 3)")
            if current_risk in ["LOW", "MEDIUM"]:
                current_risk = "HIGH"
                
        # Format general recommendations if needed
        if not alerts:
            recommendation = "Compliant"
        elif recommendation == "Maintain standard monitoring.":
            if current_risk == "CRITICAL":
                recommendation = "REVOKE IMMEDIATELY - Expiry exceeded or critical privilege violation; poses breach risk."
            elif current_risk == "HIGH":
                recommendation = "Requires immediate re-review and secondary authorization."
            else:
                recommendation = "Monitor exception details during regular review cycles."

        return EvaluationResult(
            exception_id=record.exception_id or "UNKNOWN",
            risk_level=current_risk,
            alerts=alerts,
            recommendation=recommendation
        )