import React, { useEffect, useState } from 'react';
import { SummaryMetrics } from './types';
import { MetricCard } from './components/MetricCard';
import { CSVUpload } from './components/CSVUpload';
import { ManualExceptionForm } from './components/ManualExceptionForm';
import { AnomaliesWidget } from './components/AnomaliesWidget';
import { ExceptionsRegistry } from './components/ExceptionsRegistry';
import { AuditorReport } from './components/AuditorReport';
import { PortfolioInsights } from './components/PortfolioInsights';
import { ComplianceSLAs } from './components/ComplianceSLAs';
import { RegulatoryFrameworks } from './components/RegulatoryFrameworks';
import { SystemStatus } from './components/SystemStatus';
import { AuditLedger } from './components/AuditLedger';
import { API_BASE_URL } from './config';

export default function App() {
    const [metrics, setMetrics] = useState<SummaryMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [registryRefreshTrigger, setRegistryRefreshTrigger] = useState(0);
    const [latency, setLatency] = useState<number | null>(null);

    const fetchMetrics = () => {
        const start = performance.now();
        fetch(`${API_BASE_URL}/api/summary`)
            .then(res => res.json())
            .then(data => {
                const end = performance.now();
                setMetrics(data);
                setLatency(end - start);
                setLoading(false);
                setRegistryRefreshTrigger(prev => prev + 1);
            })
            .catch(err => {
                console.error("Connection failed - Backend likely offline", err);
                setLoading(false);
            });
    };

    const handleResetDatabase = () => {
        const confirmed = window.confirm("Are you sure you want to reset the database? This will permanently delete all exception waivers and activity log history.");
        if (!confirmed) return;

        fetch(`${API_BASE_URL}/api/database/reset`, { method: 'POST' })
            .then(res => {
                if (!res.ok) throw new Error("Failed to reset database");
                return res.json();
            })
            .then(() => {
                fetchMetrics();
            })
            .catch(err => {
                console.error(err);
                alert(err.message || "Failed to reset database.");
            });
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    if (loading) return <div className="p-8 text-gray-500 font-sans">Loading GRC risk metrics...</div>;

    const activeCount = metrics?.executive_summary?.total_active_exceptions ?? 0;
    const highRiskCount = metrics?.executive_summary?.high_risk ?? 0;
    const expiredCount = metrics?.executive_summary?.expired_not_revoked ?? 0;
    const overdueCount = metrics?.next_audit_readiness?.exceptions_overdue_for_review ?? 0;

    const complianceScore = activeCount > 0 ? (100 - (highRiskCount / activeCount * 100)) : 100;
    const complianceScoreFormatted = complianceScore.toFixed(1);

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <header className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Policy Exception Registry</h1>
                    <p className="text-gray-500">Live Policy Waiver & Risk Tracking</p>
                </div>
                <button
                    onClick={handleResetDatabase}
                    className="self-start sm:self-auto text-xs px-3.5 py-2 border border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700 font-semibold rounded transition-all cursor-pointer uppercase tracking-wider active:scale-98"
                >
                    ⚠️ Reset Database
                </button>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
                <MetricCard 
                    title="Active Waivers" 
                    value={activeCount} 
                    valueColorClass="text-blue-600"
                />
                <MetricCard 
                    title="High Risk Waivers" 
                    value={highRiskCount} 
                    valueColorClass="text-orange-600"
                    borderColorClass="border-orange-100"
                />
                <MetricCard 
                    title="Expired (Active)" 
                    value={expiredCount} 
                    valueColorClass="text-red-600"
                    borderColorClass="border-red-100"
                />
                <MetricCard 
                    title="Compliance Score" 
                    value={`${complianceScoreFormatted}%`} 
                    valueColorClass="text-green-600"
                    borderColorClass="border-green-100"
                />
                <MetricCard 
                    title="Overdue for Review" 
                    value={overdueCount} 
                    valueColorClass={overdueCount > 0 ? "text-red-700 font-extrabold" : "text-gray-900"}
                    borderColorClass={overdueCount > 0 ? "border-red-200 bg-red-50/10" : "border-gray-100"}
                />
            </div>

            <PortfolioInsights refreshTrigger={registryRefreshTrigger} />

            {/* Ingestion & Single waiver entry portal */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <CSVUpload onUploadSuccess={fetchMetrics} />
                <ManualExceptionForm onSubmitSuccess={fetchMetrics} />
            </div>

            <AnomaliesWidget refreshTrigger={registryRefreshTrigger} />

            <AuditorReport refreshTrigger={registryRefreshTrigger} />

            <ExceptionsRegistry refreshTrigger={registryRefreshTrigger} onActionSuccess={fetchMetrics} />

            <AuditLedger refreshTrigger={registryRefreshTrigger} />

            <ComplianceSLAs metrics={metrics} latency={latency} />

            <RegulatoryFrameworks />

            <SystemStatus 
                statusText="Frontend architecture deployed successfully. Scanning for anomalies." 
            />
        </div>
    );
}