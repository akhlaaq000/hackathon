import React, { useState, useEffect } from 'react';
import { ExceptionRecord, PaginatedResponse } from '../types';
import { API_BASE_URL } from '../config';

interface ExceptionsRegistryProps {
    refreshTrigger: number;
    onActionSuccess: () => void;
}

export const ExceptionsRegistry: React.FC<ExceptionsRegistryProps> = ({ refreshTrigger, onActionSuccess }) => {
    const [response, setResponse] = useState<PaginatedResponse<ExceptionRecord> | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [size, setSize] = useState(10);
    const [selectedException, setSelectedException] = useState<ExceptionRecord | null>(null);
    const [renewingException, setRenewingException] = useState<ExceptionRecord | null>(null);
    const [renewJustification, setRenewJustification] = useState('');
    const [justificationError, setJustificationError] = useState<string | null>(null);
    const [isJustificationValid, setIsJustificationValid] = useState(false);
    
    // Filters
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [riskLevel, setRiskLevel] = useState('');
    const [type, setType] = useState('');
    
    // Sorting
    const [sortBy, setSortBy] = useState('exception_id');
    const [sortOrder, setSortOrder] = useState('asc');

    const fetchExceptions = () => {
        setLoading(true);
        const params = new URLSearchParams({
            page: page.toString(),
            size: size.toString(),
            sort_order: sortOrder,
        });

        if (search) params.append('search', search);
        if (status) params.append('status', status);
        if (riskLevel) params.append('risk_level', riskLevel);
        if (type) params.append('type', type);
        if (sortBy) params.append('sort_by', sortBy);

        fetch(`${API_BASE_URL}/api/exceptions?${params.toString()}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch exceptions");
                return res.json();
            })
            .then((data) => {
                setResponse(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    };

    // Refetch when page, size, sorting, or filters change, or when triggered by parent
    useEffect(() => {
        fetchExceptions();
    }, [page, size, sortBy, sortOrder, status, riskLevel, type, refreshTrigger]);

    // Prevent background scrolling when drill-down drawer is open
    useEffect(() => {
        if (selectedException) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedException]);

    // Validate justification via backend validation endpoint
    useEffect(() => {
        if (!renewingException) return;
        
        const val = renewJustification.trim();
        const originalVal = (renewingException.justification || '').trim();
        
        if (!val) {
            setJustificationError("Justification cannot be empty.");
            setIsJustificationValid(false);
            return;
        }
        
        if (val === originalVal) {
            setJustificationError("Justification must be updated to reflect current state (cannot be identical).");
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
    }, [renewJustification, renewingException]);

    // Handle search input submission
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchExceptions();
    };

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
        setPage(1);
    };

    const renderSortArrow = (column: string) => {
        if (sortBy !== column) return null;
        return sortOrder === 'asc' ? ' ▲' : ' ▼';
    };

    const handleResetFilters = () => {
        setSearch('');
        setStatus('');
        setRiskLevel('');
        setType('');
        setSortBy('exception_id');
        setSortOrder('asc');
        setPage(1);
    };

    const handleLifecycleAction = (exceptionId: string, action: 'renew' | 'revoke' | 'acknowledge', justification?: string) => {
        const options: RequestInit = {
            method: 'POST',
        };
        if (action === 'renew') {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify({ justification: justification || '' });
        }

        fetch(`${API_BASE_URL}/api/exceptions/${exceptionId}/${action}`, options)
            .then(async (res) => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const detail = errData.detail || `Failed to ${action} exception`;
                    throw new Error(detail);
                }
                return res.json();
            })
            .then(() => {
                fetchExceptions();
                onActionSuccess();
            })
            .catch((err) => {
                console.error(err);
                const isNotFound = err.message === "Exception not found";
                const displayMsg = isNotFound
                    ? "Exception not found. The database might have been reset or the record cleared."
                    : (err.message || "Failed to process lifecycle action");
                alert(`Error: ${displayMsg}`);
                if (isNotFound) {
                    fetchExceptions();
                    onActionSuccess();
                }
            });
    };

    const totalRecords = response?.total ?? 0;
    const totalPages = response?.pages ?? 0;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 font-sans">Exception Registry</h2>
                    <p className="text-sm text-gray-500">Database registry containing all ingested waivers and exceptions</p>
                </div>
                <button
                    onClick={handleResetFilters}
                    className="self-start md:self-auto text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-all font-medium"
                >
                    Reset Filters
                </button>
            </div>

            {/* Filters Toolbar */}
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {/* Search Text */}
                <div className="md:col-span-2 flex gap-2">
                    <input
                        type="text"
                        placeholder="Search requester, approver, ID, or justification..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                    />
                    <button
                        type="submit"
                        className="text-sm px-4 py-2 bg-gray-800 hover:bg-gray-950 text-white rounded transition-colors"
                    >
                        Search
                    </button>
                </div>

                {/* Status Filter */}
                <select
                    value={status}
                    onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                    }}
                    className="text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                >
                    <option value="">All Statuses</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="REVOKED">REVOKED</option>
                </select>

                {/* Risk Level Filter */}
                <select
                    value={riskLevel}
                    onChange={(e) => {
                        setRiskLevel(e.target.value);
                        setPage(1);
                    }}
                    className="text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                >
                    <option value="">All Risks</option>
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="LOW">LOW</option>
                </select>

                {/* Type Filter */}
                <select
                    value={type}
                    onChange={(e) => {
                        setType(e.target.value);
                        setPage(1);
                    }}
                    className="text-sm px-3 py-2 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50/50"
                >
                    <option value="">All Types</option>
                    <option value="ADMIN_ACCESS">ADMIN_ACCESS</option>
                    <option value="ROOT_ACCESS">ROOT_ACCESS</option>
                    <option value="DATA_EXPORT">DATA_EXPORT</option>
                    <option value="NETWORK_RULE">NETWORK_RULE</option>
                </select>
            </form>

            {/* Table Area */}
            <div className="overflow-x-auto border border-gray-150 rounded-lg mb-4">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-150 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <th 
                                onClick={() => handleSort('exception_id')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                Exception ID{renderSortArrow('exception_id')}
                            </th>
                            <th 
                                onClick={() => handleSort('type')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                Type{renderSortArrow('type')}
                            </th>
                            <th 
                                onClick={() => handleSort('requester')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                Requester{renderSortArrow('requester')}
                            </th>
                            <th 
                                onClick={() => handleSort('approver')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                Approver{renderSortArrow('approver')}
                            </th>
                            <th 
                                onClick={() => handleSort('start_date')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                Start Date{renderSortArrow('start_date')}
                            </th>
                            <th 
                                onClick={() => handleSort('end_date')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors"
                            >
                                End Date{renderSortArrow('end_date')}
                            </th>
                            <th 
                                onClick={() => handleSort('status')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors w-24 text-center"
                            >
                                Status{renderSortArrow('status')}
                            </th>
                            <th 
                                onClick={() => handleSort('risk_level')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors w-24 text-center"
                            >
                                Risk{renderSortArrow('risk_level')}
                            </th>
                            <th 
                                onClick={() => handleSort('renewal_count')}
                                className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none transition-colors w-20 text-center"
                            >
                                Renew{renderSortArrow('renewal_count')}
                            </th>
                            <th className="px-4 py-3 w-48 text-center select-none text-gray-500 uppercase tracking-wider font-semibold">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                                    Loading exceptions data...
                                </td>
                            </tr>
                        ) : response?.items && response.items.length > 0 ? (
                            response.items.map((item) => (
                                <tr 
                                    key={item.exception_id} 
                                    className="hover:bg-gray-100/60 cursor-pointer transition-colors"
                                    onClick={() => setSelectedException(item)}
                                >
                                    <td className="px-4 py-3.5 font-medium text-gray-900">{item.exception_id}</td>
                                    <td className="px-4 py-3.5 text-xs font-semibold"><span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">{item.type}</span></td>
                                    <td className="px-4 py-3.5">{item.requester}</td>
                                    <td className="px-4 py-3.5">{item.approver}</td>
                                    <td className="px-4 py-3.5 text-xs text-gray-500">{item.start_date}</td>
                                    <td className="px-4 py-3.5 text-xs text-gray-500">{item.end_date}</td>
                                    <td className="px-4 py-3.5 text-center">
                                        <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase ${
                                            item.status?.toUpperCase() === 'ACTIVE' 
                                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                                : item.status?.toUpperCase() === 'EXPIRED'
                                                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                                                : 'bg-red-50 text-red-700 border border-red-200'
                                        }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5 text-center">
                                        {item.status?.toUpperCase() === 'REVOKED' || item.status?.toUpperCase() === 'EXPIRED' ? (
                                            <span className="px-2.5 py-0.5 rounded text-xs font-semibold uppercase bg-gray-100 text-gray-500 border border-gray-200">
                                                Resolved
                                            </span>
                                        ) : (
                                            <span className={`px-2.5 py-0.5 rounded text-xs font-semibold uppercase ${
                                                item.risk_level === 'CRITICAL' 
                                                    ? 'bg-red-100 text-red-800' 
                                                    : item.risk_level === 'HIGH'
                                                    ? 'bg-orange-100 text-orange-800'
                                                    : item.risk_level === 'MEDIUM'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-green-100 text-green-800'
                                            }`}>
                                                {item.risk_level}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3.5 text-center text-xs text-gray-500 font-mono">{item.renewal_count}</td>
                                    <td className="px-4 py-3.5 text-center">
                                        <div className="flex justify-center gap-1.5 flex-wrap">
                                            {item.status?.toUpperCase() !== 'REVOKED' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setRenewingException(item);
                                                        setRenewJustification(item.justification || '');
                                                        setJustificationError(null);
                                                    }}
                                                    className="text-xs px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 font-medium active:scale-95 transition-all"
                                                    title="Extend access by 30 days and increment renewal count"
                                                >
                                                    Renew
                                                </button>
                                            )}
                                            {(item.status?.toUpperCase() === 'ACTIVE' || item.status?.toUpperCase() === 'EXPIRED') && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleLifecycleAction(item.exception_id, 'revoke'); }}
                                                    className="text-xs px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded border border-red-200 font-medium active:scale-95 transition-all"
                                                    title="Revoke access immediately"
                                                >
                                                    Revoke
                                                </button>
                                            )}
                                            {((item.risk_level === 'CRITICAL' || item.risk_level === 'HIGH') && (!item.justification || !item.justification.startsWith('[ACKNOWLEDGED]'))) && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleLifecycleAction(item.exception_id, 'acknowledge'); }}
                                                    className="text-xs px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 font-medium active:scale-95 transition-all"
                                                    title="Acknowledge exception risk and mitigate risk rating"
                                                >
                                                    Ack Risk
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                                    No records found in database matching your selection.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {!loading && response && response.items.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-4">
                        <span>
                            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalRecords} records total)
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs">Page Size:</span>
                            <select
                                value={size}
                                onChange={(e) => {
                                    setSize(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(p - 1, 1))}
                            disabled={page === 1}
                            className={`px-3 py-1.5 rounded border text-xs font-semibold ${
                                page === 1 
                                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                                    : 'bg-white hover:bg-gray-50 text-gray-700 active:scale-95 transition-all'
                            }`}
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                            disabled={page === totalPages}
                            className={`px-3 py-1.5 rounded border text-xs font-semibold ${
                                page === totalPages 
                                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed' 
                                    : 'bg-white hover:bg-gray-50 text-gray-700 active:scale-95 transition-all'
                            }`}
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* selected exception drill-down side panel */}
            {selectedException && (
                <>
                    {/* Overlay */}
                    <div 
                        className="fixed inset-0 bg-black/40 z-45 transition-opacity" 
                        onClick={() => setSelectedException(null)}
                    />
                    {/* Drawer */}
                    <DrawerPanel 
                        exception={selectedException} 
                        onClose={() => setSelectedException(null)} 
                    />
                </>
            )}

            {/* Renewal Verification Modal */}
            {renewingException && (
                <>
                    {/* Dark Overlay with Blur */}
                    <div 
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[99] transition-opacity" 
                        onClick={() => setRenewingException(null)}
                    />
                    {/* Centered Modal Container */}
                    <div className="fixed inset-0 flex items-center justify-center z-[100] p-4 pointer-events-none">
                        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden flex flex-col font-sans text-left pointer-events-auto transform transition-all scale-100 duration-200">
                            {/* Header */}
                            <div className="p-5 border-b border-gray-150 bg-slate-50 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">Policy Renewal Control</span>
                                    <h3 className="text-lg font-bold text-slate-950 mt-0.5">
                                        Renew Exception: {renewingException.exception_id}
                                    </h3>
                                </div>
                                <button 
                                    onClick={() => setRenewingException(null)} 
                                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all font-bold text-lg"
                                >
                                    ✕
                                </button>
                            </div>
                            
                            {/* Body */}
                            <div className="p-6 space-y-5">
                                <div className="text-sm text-slate-600 leading-relaxed">
                                    To renew this policy exception for an additional <strong className="text-slate-900 font-semibold">30 days</strong>, GRC policy mandates that you review and provide an updated justification.
                                </div>
                                
                                <div className="bg-slate-50 p-4 rounded-lg border border-slate-150 text-xs space-y-1">
                                    <span className="font-bold text-slate-400 uppercase tracking-wider block">Current Justification:</span>
                                    <div className="italic text-slate-700 font-medium">
                                        "{renewingException.justification || 'No justification specified.'}"
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        Updated Justification
                                    </label>
                                    <textarea
                                        value={renewJustification}
                                        onChange={(e) => setRenewJustification(e.target.value)}
                                        rows={4}
                                        placeholder="Explain the technical/regulatory necessity for this extension. Use detailed description..."
                                        className="w-full text-sm px-3.5 py-2.5 border border-slate-250 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-inner font-medium text-slate-800"
                                    />
                                    
                                    {/* Live Audit Checklist */}
                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 grid grid-cols-1 gap-2 text-xs font-semibold">
                                        {(() => {
                                            const val = renewJustification.trim();
                                            const isNotEmpty = val.length > 0;
                                            const isChanged = val !== (renewingException.justification || '').trim();
                                            
                                            return (
                                                <>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 font-medium">1. Text is provided</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${isNotEmpty ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                            {isNotEmpty ? 'Passed' : 'Required'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 font-medium">2. Justification was modified</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${isChanged ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                            {isChanged ? 'Passed' : 'Required'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-500 font-medium">3. GRC Compliance Check (Backend)</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${isJustificationValid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                            {isJustificationValid ? 'Passed' : 'Required'}
                                                        </span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                    
                                    {justificationError && (
                                        <p className="text-xs text-rose-600 mt-2 font-semibold bg-rose-50 p-2.5 rounded border border-rose-100">
                                            ⚠️ {justificationError}
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            {/* Footer */}
                            <div className="p-4 border-t border-slate-150 bg-slate-50 flex justify-end gap-3">
                                <button
                                    onClick={() => setRenewingException(null)}
                                    className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-lg transition-all active:scale-95"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={!isJustificationValid}
                                    onClick={() => {
                                        handleLifecycleAction(renewingException.exception_id, 'renew', renewJustification);
                                        setRenewingException(null);
                                    }}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all active:scale-95 shadow-sm"
                                >
                                    Submit Renewal
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

interface DrawerPanelProps {
    exception: ExceptionRecord;
    onClose: () => void;
}

const DrawerPanel: React.FC<DrawerPanelProps> = ({ exception, onClose }) => {
    const [evalResult, setEvalResult] = useState<any>(null);
    const [userActiveCount, setUserActiveCount] = useState<number>(0);
    const [associatedAnomalies, setAssociatedAnomalies] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // 1. Evaluate via risk engine
        const evalPromise = fetch(`${API_BASE_URL}/api/evaluate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(exception)
        }).then(res => res.json());

        // 2. Count active exceptions for this requester
        const countPromise = fetch(`${API_BASE_URL}/api/exceptions?size=100&status=ACTIVE&search=${encodeURIComponent(exception.requester)}`)
            .then(res => res.json())
            .then(data => {
                const normalizedTarget = exception.requester.toLowerCase().trim();
                const exactItems = (data.items || []).filter((item: any) => {
                    const itemNorm = (item.requester || "").toLowerCase().trim();
                    return itemNorm === normalizedTarget;
                });
                return exactItems.length;
            });
        // 3. Fetch active anomalies and filter (up to page size of 100)
        const anomaliesPromise = fetch(`${API_BASE_URL}/api/anomalies?size=100`)
            .then(res => res.json())
            .then(data => {
                const normalizedTargetRequester = exception.requester.toLowerCase().trim();
                const anomalyList = data.items || [];
                return anomalyList.filter((anomaly: any) => {
                    const anomalyExcId = anomaly.exception_id;
                    const anomalyReq = (anomaly.requester || "").toLowerCase().trim();
                    
                    if (anomalyExcId && anomalyExcId === exception.exception_id) {
                        return true;
                    }
                    if (!anomalyExcId && anomalyReq === normalizedTargetRequester) {
                        return true;
                    }
                    return false;
                });
            });

        Promise.all([evalPromise, countPromise, anomaliesPromise])
            .then(([evalData, count, anomalies]) => {
                setEvalResult(evalData);
                setUserActiveCount(count);
                setAssociatedAnomalies(anomalies);
                setLoading(false);
            })
            .catch(err => {
                console.error("Drawer loading error:", err);
                setLoading(false);
            });
    }, [exception]);

    const getStatusBadgeClass = (status: string) => {
        switch (status.toUpperCase()) {
            case 'ACTIVE': return 'bg-green-50 text-green-700 border-green-200';
            case 'EXPIRED': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
            default: return 'bg-red-50 text-red-700 border-red-200';
        }
    };

    const getRiskBadgeClass = (risk: string) => {
        switch (risk.toUpperCase()) {
            case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
            case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            default: return 'bg-green-100 text-green-800 border-green-200';
        }
    };

    return (
        <div className="fixed right-0 top-0 h-full w-full sm:w-[540px] bg-white shadow-2xl z-50 transform translate-x-0 transition-transform duration-300 ease-out flex flex-col font-sans border-l border-gray-200 text-left">
            {/* Header */}
            <div className="p-5 border-b border-gray-150 flex items-center justify-between bg-gray-50">
                <div>
                    <span className="text-[10px] font-bold tracking-wider text-gray-400 uppercase font-mono">Waiver Record profile</span>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 mt-0.5">
                        {exception.exception_id}
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getStatusBadgeClass(exception.status)}`}>
                            {exception.status}
                        </span>
                    </h3>
                </div>
                <button 
                    onClick={onClose} 
                    className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all font-bold text-lg"
                >
                    ✕
                </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Section 1: Standard Metadata */}
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Waiver Metadata Details</h4>
                    <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-lg border border-gray-150 text-sm">
                        <div>
                            <span className="text-xs text-gray-400 block mb-0.5">Exception Type</span>
                            <strong className="text-gray-800 text-xs"><span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-mono">{exception.type}</span></strong>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block mb-0.5">Risk Rating</span>
                            {exception.status?.toUpperCase() === 'REVOKED' || exception.status?.toUpperCase() === 'EXPIRED' ? (
                                <span className="px-2.5 py-0.5 text-xs font-bold rounded border bg-gray-100 text-gray-500 border-gray-250 inline-block uppercase">
                                    Resolved
                                </span>
                            ) : (
                                <span className={`px-2.5 py-0.5 text-xs font-bold rounded border inline-block ${getRiskBadgeClass(exception.risk_level)}`}>
                                    {exception.risk_level}
                                </span>
                            )}
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block mb-0.5">Requester (Normalized)</span>
                            <strong className="text-gray-800">{exception.requester}</strong>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block mb-0.5">Approving Authority</span>
                            <strong className="text-gray-800">{exception.approver}</strong>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block mb-0.5">Valid Period</span>
                            <strong className="text-gray-800 text-xs font-mono">{exception.start_date} to {exception.end_date}</strong>
                        </div>
                        <div>
                            <span className="text-xs text-gray-400 block mb-0.5">Renewals Applied</span>
                            <strong className="text-gray-800 font-mono">{exception.renewal_count} times</strong>
                        </div>
                    </div>
                    
                    <div className="mt-3 bg-gray-50/50 p-4 rounded-lg border border-gray-150 text-sm">
                        <span className="text-xs text-gray-400 block mb-1">Stated Justification</span>
                        <p className="text-gray-700 italic leading-relaxed">"{exception.justification || 'No business justification specified.'}"</p>
                    </div>
                </div>

                {/* Section 2: Real-time Risk Engine Evaluation */}
                <div className="border-t border-gray-200 pt-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Risk Engine Assessment</h4>
                    {loading ? (
                        <div className="py-4 text-center text-xs text-gray-400">Running compliance engine scan...</div>
                    ) : evalResult ? (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-600">Calculated Risk Priority:</span>
                                <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getRiskBadgeClass(evalResult.risk_level)}`}>
                                    {evalResult.risk_level}
                                </span>
                            </div>
                            
                            <div className="bg-blue-50/60 border border-blue-150 p-4 rounded-lg text-sm text-blue-900">
                                <strong className="text-xs text-blue-700 uppercase tracking-wider block mb-1">Compliance Recommendation</strong>
                                <p className="font-semibold leading-relaxed">{evalResult.recommendation}</p>
                            </div>

                            {evalResult.alerts && evalResult.alerts.length > 0 && (
                                <div className="bg-red-50/40 border border-red-100 p-4 rounded-lg text-sm text-red-950">
                                    <strong className="text-xs text-red-700 uppercase tracking-wider block mb-1.5">Evaluated Threat Indicators</strong>
                                    <ul className="list-disc list-inside space-y-1 text-xs">
                                        {evalResult.alerts.map((alert: string, idx: number) => (
                                            <li key={idx} className="font-medium text-red-800 leading-normal">{alert}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="py-4 text-center text-xs text-red-500">Failed to load Risk Engine results.</div>
                    )}
                </div>

                {/* Section 3: Aggregate Requester Risk */}
                <div className="border-t border-gray-200 pt-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Requester Exposure Telemetry</h4>
                    {loading ? (
                        <div className="py-4 text-center text-xs text-gray-400">Loading exposure telemetry...</div>
                    ) : (
                        <div className="bg-gray-50/60 p-4 rounded-lg border border-gray-150 flex items-center justify-between">
                            <div>
                                <span className="text-xs text-gray-500 block">Requester Aggregate active Waivers</span>
                                <p className="text-sm font-semibold text-gray-800 mt-0.5">
                                    User <strong className="text-blue-600 font-bold">{exception.requester}</strong> holds <strong className="text-gray-900 font-extrabold">{userActiveCount}</strong> active exception{userActiveCount !== 1 ? 's' : ''}.
                                </p>
                            </div>
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full border uppercase tracking-wider shrink-0 ${
                                userActiveCount >= 10 
                                    ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                                    : userActiveCount >= 5
                                    ? 'bg-orange-50 text-orange-700 border-orange-200'
                                    : 'bg-green-50 text-green-700 border-green-200'
                            }`}>
                                {userActiveCount >= 10 ? 'Accumulated Risk' : userActiveCount >= 5 ? 'Warning Exposure' : 'Low Exposure'}
                            </span>
                        </div>
                    )}
                </div>

                {/* Section 4: Triggered Anomalies Feed */}
                <div className="border-t border-gray-200 pt-5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Triggered System Anomalies</h4>
                    {loading ? (
                        <div className="py-4 text-center text-xs text-gray-400">Matching anomalies...</div>
                    ) : associatedAnomalies && associatedAnomalies.length > 0 ? (
                        <div className="space-y-3">
                            {associatedAnomalies.map((anomaly, idx) => (
                                <div key={idx} className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-sm text-xs leading-relaxed flex items-start gap-2.5">
                                    <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase shrink-0 ${
                                        anomaly.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                                        anomaly.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                                        'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {anomaly.severity}
                                    </span>
                                    <div>
                                        <strong className="text-gray-900 block font-mono text-[10px] uppercase mb-0.5">{anomaly.anomaly_type.replace('_', ' ')}</strong>
                                        <p className="text-gray-600 font-medium">{anomaly.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-green-50/50 p-4 rounded-lg border border-green-100 text-green-800 flex items-center gap-2 text-xs font-medium">
                            <span>✓</span> No active compliance anomalies triggered by this exception.
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
