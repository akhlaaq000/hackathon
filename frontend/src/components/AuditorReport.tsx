import React, { useState, useEffect } from 'react';
import { ExceptionRecord } from '../types';
import { API_BASE_URL } from '../config';

interface ReportItem extends ExceptionRecord {
    alerts: string[];
    recommendation: string;
}

interface AuditorReportProps {
    refreshTrigger: number;
}

// No client-side HTML-to-PDF libraries required

export const AuditorReport: React.FC<AuditorReportProps> = ({ refreshTrigger }) => {
    const [reportItems, setReportItems] = useState<ReportItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPreview, setShowPreview] = useState(false);
    const [generatingExecPdf, setGeneratingExecPdf] = useState(false);
    const [generatingDetailedPdf, setGeneratingDetailedPdf] = useState(false);

    const fetchReportData = () => {
        setLoading(true);
        fetch(`${API_BASE_URL}/api/exceptions/high-risk-report`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch report data");
                return res.json();
            })
            .then(data => {
                setReportItems(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchReportData();
    }, [refreshTrigger]);

    const [exportingRegister, setExportingRegister] = useState(false);
    const [exportingAnomalies, setExportingAnomalies] = useState(false);
    const [exportingCompliance, setExportingCompliance] = useState(false);

    const handleDownloadRegisterXLSX = () => {
        setExportingRegister(true);
        fetch(`${API_BASE_URL}/api/exceptions/export/xlsx`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to export Exception Register.");
                return res.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `grc_exceptions_register_${new Date().toISOString().slice(0, 10)}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setExportingRegister(false);
            })
            .catch(err => {
                console.error(err);
                alert(err.message || "Failed to download Exception Register spreadsheet.");
                setExportingRegister(false);
            });
    };

    const handleDownloadAnomaliesXLSX = () => {
        setExportingAnomalies(true);
        fetch(`${API_BASE_URL}/api/anomalies/export/xlsx`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to export Anomalies.");
                return res.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `grc_active_anomalies_${new Date().toISOString().slice(0, 10)}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setExportingAnomalies(false);
            })
            .catch(err => {
                console.error(err);
                alert(err.message || "Failed to download Anomalies spreadsheet.");
                setExportingAnomalies(false);
            });
    };

    const handleDownloadComplianceXLSX = () => {
        if (reportItems.length === 0) {
            alert("No data available to export.");
            return;
        }
        setExportingCompliance(true);
        fetch(`${API_BASE_URL}/api/compliance/export/xlsx`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to export Compliance Report.");
                return res.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `grc_compliance_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setExportingCompliance(false);
            })
            .catch(err => {
                console.error(err);
                alert(err.message || "Failed to download Compliance Report spreadsheet.");
                setExportingCompliance(false);
            });
    };

    const handleDownloadExecutivePDF = () => {
        if (reportItems.length === 0) {
            alert("No data available to export.");
            return;
        }

        setGeneratingExecPdf(true);
        
        fetch(`${API_BASE_URL}/api/exceptions/high-risk-report/pdf/executive`)
            .then(async (res) => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const detail = errData.detail || "Failed to generate Executive PDF report on backend.";
                    if (detail.toLowerCase().includes("pandoc") || detail.toLowerCase().includes("typst")) {
                        throw new Error(`${detail} Please ensure Pandoc and Typst are installed on the server backend.`);
                    }
                    throw new Error(detail);
                }
                return res.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `grc_executive_audit_report_${new Date().toISOString().slice(0, 10)}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setGeneratingExecPdf(false);
            })
            .catch(err => {
                console.error("Executive PDF generation error:", err);
                alert(err.message || "Failed to download Executive PDF.");
                setGeneratingExecPdf(false);
            });
    };

    const handleDownloadDetailedPDF = () => {
        if (reportItems.length === 0) {
            alert("No data available to export.");
            return;
        }

        setGeneratingDetailedPdf(true);
        
        fetch(`${API_BASE_URL}/api/exceptions/high-risk-report/pdf/detailed`)
            .then(async (res) => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const detail = errData.detail || "Failed to generate Detailed PDF report on backend.";
                    if (detail.toLowerCase().includes("pandoc") || detail.toLowerCase().includes("typst")) {
                        throw new Error(`${detail} Please ensure Pandoc and Typst are installed on the server backend.`);
                    }
                    throw new Error(detail);
                }
                return res.blob();
            })
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `grc_detailed_audit_report_${new Date().toISOString().slice(0, 10)}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                setGeneratingDetailedPdf(false);
            })
            .catch(err => {
                console.error("Detailed PDF generation error:", err);
                alert(err.message || "Failed to download Detailed PDF.");
                setGeneratingDetailedPdf(false);
            });
    };

    const criticalCount = reportItems.filter(item => item.risk_level === 'CRITICAL').length;
    const highCount = reportItems.filter(item => item.risk_level === 'HIGH').length;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8 font-sans">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Auditor Reporting & Export</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Export live active, high-risk exceptions and programmatic security recommendations for audit compliance.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-xs px-3.5 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-md transition-colors"
                        disabled={loading}
                    >
                        {showPreview ? "Hide Preview" : "Preview Report"}
                    </button>
                    <button
                        onClick={handleDownloadRegisterXLSX}
                        className="text-xs px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-md border border-emerald-200 transition-colors flex items-center gap-1"
                        disabled={loading || exportingRegister}
                    >
                        {exportingRegister ? "Exporting..." : "Exception Register Excel"}
                    </button>
                    <button
                        onClick={handleDownloadAnomaliesXLSX}
                        className="text-xs px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-md border border-emerald-200 transition-colors flex items-center gap-1"
                        disabled={loading || exportingAnomalies}
                    >
                        {exportingAnomalies ? "Exporting..." : "Anomaly Log Excel"}
                    </button>
                    <button
                        onClick={handleDownloadComplianceXLSX}
                        className="text-xs px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-md border border-emerald-200 transition-colors flex items-center gap-1"
                        disabled={loading || reportItems.length === 0 || exportingCompliance}
                    >
                        {exportingCompliance ? "Exporting..." : "Compliance Report Excel"}
                    </button>
                    <button
                        onClick={handleDownloadExecutivePDF}
                        className="text-xs px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors shadow-sm flex items-center gap-1.5"
                        disabled={loading || reportItems.length === 0 || generatingExecPdf}
                    >
                        {generatingExecPdf ? (
                            <>
                                <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full inline-block"></span>
                                Generating Exec PDF...
                            </>
                        ) : (
                            "Export Exec PDF"
                        )}
                    </button>
                    <button
                        onClick={handleDownloadDetailedPDF}
                        className="text-xs px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors shadow-sm flex items-center gap-1.5"
                        disabled={loading || reportItems.length === 0 || generatingDetailedPdf}
                    >
                        {generatingDetailedPdf ? (
                            <>
                                <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full inline-block"></span>
                                Generating Detailed PDF...
                            </>
                        ) : (
                            "Export Detailed PDF"
                        )}
                    </button>
                </div>
            </div>

            {/* Quick stats indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                <div className="bg-red-50/50 p-3 rounded-lg border border-red-100">
                    <span className="text-xs text-red-600 font-medium">Critical Violations Found</span>
                    <p className="text-xl font-bold text-red-800 mt-0.5">{loading ? "..." : criticalCount}</p>
                </div>
                <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                    <span className="text-xs text-orange-600 font-medium">High Risk Items</span>
                    <p className="text-xl font-bold text-orange-800 mt-0.5">{loading ? "..." : highCount}</p>
                </div>
                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                    <span className="text-xs text-blue-600 font-medium">Total High-Risk Active</span>
                    <p className="text-xl font-bold text-blue-800 mt-0.5">{loading ? "..." : reportItems.length}</p>
                </div>
                <div className="bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                    <span className="text-xs text-gray-500 font-medium">Audit Readiness Status</span>
                    <p className={`text-sm font-bold mt-1.5 ${reportItems.length > 0 ? "text-amber-700" : "text-green-700"}`}>
                        {loading ? "Scanning..." : reportItems.length > 0 ? "Attention Required" : "Fully Compliant"}
                    </p>
                </div>
            </div>

            {/* Live Interactive Preview */}
            {showPreview && (
                <div className="mt-6 border border-gray-200 rounded-lg p-5 bg-gray-50/30">
                    <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-4">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Audit Report Preview</span>
                        <span className="text-xs text-gray-400">Generated: {new Date().toLocaleString()}</span>
                    </div>

                    {loading ? (
                        <div className="py-8 text-center text-gray-400 text-sm">Loading preview details...</div>
                    ) : reportItems.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-sm">
                            No active high-risk exceptions currently exist. Your portfolio is clean!
                        </div>
                    ) : (
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                            {reportItems.map(item => (
                                <div key={item.exception_id} className="bg-white p-4 rounded-md border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className="text-sm font-bold text-gray-900">{item.exception_id}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                item.risk_level === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'
                                            }`}>
                                                {item.risk_level}
                                            </span>
                                            <span className="text-xs text-gray-400">| {item.type}</span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600 mb-3 bg-gray-50 p-2.5 rounded">
                                            <div><strong>Requester:</strong> {item.requester}</div>
                                            <div><strong>Approver:</strong> {item.approver}</div>
                                            <div><strong>Expires:</strong> {item.end_date}</div>
                                            <div><strong>Renewals:</strong> {item.renewal_count}</div>
                                        </div>
                                        <div className="text-xs text-gray-700 mb-2">
                                            <strong>Justification:</strong> <span className="italic">"{item.justification || "No justification provided."}"</span>
                                        </div>
                                    </div>
                                    <div className="w-full md:w-80 bg-blue-50/40 border border-blue-100 p-3 rounded-md">
                                        <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block mb-1">Programmatic Recommendation</span>
                                        <p className="text-xs text-blue-900 font-medium leading-relaxed">{item.recommendation}</p>
                                        {item.alerts && item.alerts.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-blue-100/50">
                                                <span className="text-[9px] font-bold text-red-600 uppercase block mb-0.5">Policy Triggers</span>
                                                <ul className="list-disc list-inside text-[10px] text-red-800 space-y-0.5">
                                                    {item.alerts.map((alertStr, idx) => (
                                                        <li key={idx}>{alertStr}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};
