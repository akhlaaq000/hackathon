export interface SummaryMetrics {
    report_date: string;
    time_range: string;
    executive_summary: {
        total_active_exceptions: number;
        high_risk: number;
        medium_risk: number;
        low_risk: number;
        expiring_this_month: number;
        expired_not_revoked: number;
    };
    breakdown_by_type: {
        admin_root_access: number;
        firewall_rules: number;
        encryption_waivers: number;
        other: number;
    };
    top_high_risk_exceptions: string[];
    recommendations: string[];
    next_audit_readiness: {
        all_exceptions_documented: boolean;
        approvals_recorded_percentage: number;
        exceptions_overdue_for_review: number;
        exceptions_not_revoked_after_expiry: number;
    };
}

export interface ExceptionRecord {
    exception_id: string;
    type: string;
    requester: string;
    approver: string;
    justification: string;
    start_date: string;
    end_date: string;
    status: string;
    risk_level: string;
    renewal_count: number;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    size: number;
    pages: number;
}

export interface Anomaly {
    exception_id?: string | null;
    requester?: string | null;
    anomaly_type: string;
    severity: string;
    description: string;
    date_detected: string;
}

export interface AuditLog {
    id: number;
    timestamp: string;
    action: string;
    exception_id: string;
    operator: string;
    details: string;
}
