import React, { useState, useEffect } from 'react';
import { ExceptionRecord } from '../types';
import { API_BASE_URL } from '../config';

const formatErrorDetail = (detail: any): string => {
    if (!detail) return "";
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
        return detail.map((err: any) => {
            const field = err.loc && err.loc.length > 1 ? err.loc.slice(1).join('.') : '';
            return field ? `${field}: ${err.msg}` : err.msg;
        }).join('; ');
    }
    return JSON.stringify(detail);
};

interface ManualExceptionFormProps {
    onSubmitSuccess: () => void;
}

export const ManualExceptionForm: React.FC<ManualExceptionFormProps> = ({ onSubmitSuccess }) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    const defaultEndStr = thirtyDaysLater.toISOString().slice(0, 10);

    const [exceptionId, setExceptionId] = useState('');
    const [type, setType] = useState('ADMIN_ACCESS');
    const [customType, setCustomType] = useState('');
    const [requester, setRequester] = useState('');
    const [approver, setApprover] = useState('');
    const [justification, setJustification] = useState('');
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(defaultEndStr);
    const [status, setStatus] = useState('ACTIVE');
    const [riskLevel, setRiskLevel] = useState('LOW');
    
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const [justificationError, setJustificationError] = useState<string | null>(null);
    const [isJustificationValid, setIsJustificationValid] = useState(false);

    // Validate justification via backend validation endpoint
    useEffect(() => {
        const val = justification.trim();
        if (!val) {
            setJustificationError("Justification is required.");
            setIsJustificationValid(false);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            fetch(`${API_BASE_URL}/api/validate-justification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ justification: val }),
                signal: controller.signal
            })
            .then(res => {
                if (!res.ok) throw new Error("Validation failed");
                return res.json();
            })
            .then(data => {
                if (data.is_valid) {
                    setJustificationError(null);
                    setIsJustificationValid(true);
                } else {
                    setJustificationError(data.reason || "Invalid justification");
                    setIsJustificationValid(false);
                }
            })
            .catch(err => {
                if (err.name !== 'AbortError') {
                    console.error("Justification validation error:", err);
                }
            });
        }, 150);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [justification]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (!exceptionId.trim()) {
            setMessage({ text: "Exception ID is required.", isError: true });
            return;
        }
        const excIdRegex = /^EXC-\d+$/i;
        if (!excIdRegex.test(exceptionId.trim())) {
            setMessage({ text: "Exception ID must match the format 'EXC-XXXX' (e.g., EXC-1001).", isError: true });
            return;
        }
        if (!requester.trim()) {
            setMessage({ text: "Requester name is required.", isError: true });
            return;
        }
        const userRegex = /^[a-zA-Z0-9._-]+$/;
        if (!userRegex.test(requester.trim())) {
            setMessage({ text: "Requester name must only contain alphanumeric characters, dots, underscores, or hyphens.", isError: true });
            return;
        }
        if (!approver.trim()) {
            setMessage({ text: "Approver name is required.", isError: true });
            return;
        }
        if (!userRegex.test(approver.trim())) {
            setMessage({ text: "Approver name must only contain alphanumeric characters, dots, underscores, or hyphens.", isError: true });
            return;
        }
        if (!isJustificationValid) {
            setMessage({ text: justificationError || "Justification validation failed.", isError: true });
            return;
        }

        const finalType = type === 'CUSTOM' ? customType.trim() : type;
        if (!finalType) {
            setMessage({ text: "Please enter or select a waiver type.", isError: true });
            return;
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate.trim())) {
            setMessage({ text: "Start Date is required and must be in YYYY-MM-DD format.", isError: true });
            return;
        }
        if (!dateRegex.test(endDate.trim())) {
            setMessage({ text: "End Date is required and must be in YYYY-MM-DD format.", isError: true });
            return;
        }

        const start = new Date(startDate.trim());
        const end = new Date(endDate.trim());
        if (isNaN(start.getTime())) {
            setMessage({ text: "Start Date is not a valid calendar date.", isError: true });
            return;
        }
        if (isNaN(end.getTime())) {
            setMessage({ text: "End Date is not a valid calendar date.", isError: true });
            return;
        }
        if (start > end) {
            setMessage({ text: "Start Date cannot be after End Date.", isError: true });
            return;
        }

        setSubmitting(true);
        setMessage(null);

        const newRecord = {
            exception_id: exceptionId.trim(),
            type: finalType,
            requester: requester.trim(),
            approver: approver.trim(),
            justification: justification.trim(),
            start_date: startDate,
            end_date: endDate,
            status: status,
            risk_level: riskLevel,
            renewal_count: 0
        };

        fetch(`${API_BASE_URL}/api/exceptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(newRecord),
        })
            .then(async res => {
                const data = await res.json();
                if (res.ok) {
                    setMessage({ text: `Exception ${newRecord.exception_id} registered successfully!`, isError: false });
                    // Reset form fields
                    setExceptionId('');
                    setRequester('');
                    setApprover('');
                    setJustification('');
                    setCustomType('');
                    setType('ADMIN_ACCESS');
                    setStartDate(todayStr);
                    setEndDate(defaultEndStr);
                    setStatus('ACTIVE');
                    setRiskLevel('LOW');
                    onSubmitSuccess();
                } else {
                    setMessage({ text: formatErrorDetail(data.detail) || "Failed to submit exception.", isError: true });
                }
            })
            .catch(err => {
                console.error("Submission error", err);
                setMessage({ text: "Network error. Ensure the GRC backend is online.", isError: true });
            })
            .finally(() => {
                setSubmitting(false);
            });
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
            <div>
                <h2 className="text-xl font-semibold mb-4 text-gray-900 font-sans">Create Single Exception</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* ID */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Exception ID</label>
                            <input
                                type="text"
                                placeholder="e.g. EXC-0145"
                                value={exceptionId}
                                onChange={(e) => setExceptionId(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                            />
                        </div>
                        {/* Type */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Waiver Type</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                            >
                                <option value="ADMIN_ACCESS">ADMIN_ACCESS</option>
                                <option value="ROOT_ACCESS">ROOT_ACCESS</option>
                                <option value="DATA_EXPORT">DATA_EXPORT</option>
                                <option value="NETWORK_RULE">NETWORK_RULE</option>
                                <option value="CUSTOM">Other (Custom Type)...</option>
                            </select>
                        </div>
                    </div>

                    {type === 'CUSTOM' && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Custom Type Name</label>
                            <input
                                type="text"
                                placeholder="Enter custom type..."
                                value={customType}
                                onChange={(e) => setCustomType(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Requester */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Requester</label>
                            <input
                                type="text"
                                placeholder="e.g. john.doe"
                                value={requester}
                                onChange={(e) => setRequester(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                            />
                        </div>
                        {/* Approver */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Approver</label>
                            <input
                                type="text"
                                placeholder="e.g. alice.smith"
                                value={approver}
                                onChange={(e) => setApprover(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Start Date */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start Date</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full text-sm pl-3 pr-10 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 relative"
                            />
                        </div>
                        {/* End Date */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">End Date</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full text-sm pl-3 pr-10 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50 relative"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Risk Level */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Risk Rating</label>
                            <select
                                value={riskLevel}
                                onChange={(e) => setRiskLevel(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                            >
                                <option value="LOW">LOW</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="HIGH">HIGH</option>
                                <option value="CRITICAL">CRITICAL</option>
                            </select>
                        </div>
                        {/* Status */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                            >
                                <option value="ACTIVE">ACTIVE</option>
                                <option value="EXPIRED">EXPIRED</option>
                                <option value="REVOKED">REVOKED</option>
                            </select>
                        </div>
                    </div>

                    {/* Justification */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Business Justification</label>
                        <textarea
                            rows={3}
                            placeholder="Provide a detailed business justification explaining access needs..."
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                        />
                        {/* Live Audit / Vague Justification Validation */}
                        {justification.trim() && (
                            <div className="mt-1">
                                {justificationError ? (
                                    <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2 rounded border border-rose-100 mt-1">
                                        ⚠️ {justificationError}
                                    </p>
                                ) : isJustificationValid ? (
                                    <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 p-2 rounded border border-emerald-100 mt-1">
                                        ✓ Justification meets audit compliance standards.
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-500 font-semibold bg-slate-50 p-2 rounded border border-slate-100 mt-1">
                                        Checking compliance status...
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || !isJustificationValid}
                        className={`w-full py-2.5 rounded font-medium text-white shadow-sm transition-all ${
                            (submitting || !isJustificationValid)
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                        }`}
                    >
                        {submitting ? "Registering..." : "Save Exception Waiver"}
                    </button>
                </form>

                {message && (
                    <div className={`mt-3 p-3 rounded border text-xs ${
                        message.isError 
                            ? 'bg-red-50 text-red-800 border-red-200' 
                            : 'bg-green-50 text-green-800 border-green-200'
                    }`}>
                        {message.text}
                    </div>
                )}
            </div>
        </div>
    );
};
