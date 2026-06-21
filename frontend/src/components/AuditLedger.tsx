import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { API_BASE_URL } from '../config';

interface AuditLedgerProps {
    refreshTrigger: number;
}

export const AuditLedger: React.FC<AuditLedgerProps> = ({ refreshTrigger }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [localRefreshTrigger, setLocalRefreshTrigger] = useState(0);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Drawer-specific state
    const [drawerLogs, setDrawerLogs] = useState<AuditLog[]>([]);
    const [drawerPage, setDrawerPage] = useState(1);
    const [drawerTotalPages, setDrawerTotalPages] = useState(1);
    const [drawerTotalCount, setDrawerTotalCount] = useState(0);
    const [loadingDrawer, setLoadingDrawer] = useState(false);

    const fetchLogs = () => {
        setLoading(true);
        fetch(`${API_BASE_URL}/api/audit-logs?page=1&size=5`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch audit ledger");
                return res.json();
            })
            .then(data => {
                setLogs(data.items);
                setTotalCount(data.total);
                setLoading(false);
            })
            .catch(err => {
                console.error("Ledger fetch error:", err);
                setLoading(false);
            });
    };

    const fetchDrawerLogs = (page: number, append: boolean) => {
        setLoadingDrawer(true);
        const params = new URLSearchParams({
            page: page.toString(),
            size: '50'
        });
        if (search) params.append('search', search);
        if (actionFilter) params.append('action', actionFilter);

        fetch(`${API_BASE_URL}/api/audit-logs?${params.toString()}`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch drawer logs");
                return res.json();
            })
            .then(data => {
                if (append) {
                    setDrawerLogs(prev => [...prev, ...data.items]);
                } else {
                    setDrawerLogs(data.items);
                }
                setDrawerPage(data.page);
                setDrawerTotalPages(data.pages);
                setDrawerTotalCount(data.total);
                setLoadingDrawer(false);
            })
            .catch(err => {
                console.error("Drawer logs fetch error:", err);
                setLoadingDrawer(false);
            });
    };

    useEffect(() => {
        fetchLogs();
    }, [refreshTrigger, localRefreshTrigger]);

    useEffect(() => {
        if (isDrawerOpen) {
            fetchDrawerLogs(1, false);
        }
    }, [search, actionFilter, isDrawerOpen, refreshTrigger, localRefreshTrigger]);

    // Prevent background scrolling when drawer is open
    useEffect(() => {
        if (isDrawerOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isDrawerOpen]);

    const handleLoadMoreDrawer = () => {
        if (drawerPage < drawerTotalPages) {
            fetchDrawerLogs(drawerPage + 1, true);
        }
    };

    const getActionBadgeColor = (action: string) => {
        switch (action.toUpperCase()) {
            case 'CREATED':
                return 'bg-green-50 text-green-700 border-green-200';
            case 'UPDATED':
                return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'IMPORTED':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'RENEWED':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'REVOKED':
                return 'bg-red-50 text-red-700 border-red-200';
            case 'ACKNOWLEDGED':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            default:
                return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    const recentLogs = logs;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8 font-sans">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        Compliance Database Ledger &amp; Console
                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 font-bold uppercase rounded border border-gray-200 tracking-wide font-mono">
                            Immutable Ledger
                        </span>
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Chronological audit trail of all manual and automated compliance operations</p>
                </div>
                <button
                    onClick={() => setLocalRefreshTrigger(p => p + 1)}
                    className="self-start sm:self-auto text-xs px-3 py-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded transition-all font-semibold"
                    disabled={loading}
                >
                    {loading ? "Syncing..." : "Refresh Console"}
                </button>
            </div>

            {/* Compact Console Preview (Top 5) */}
            <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 font-mono text-xs text-gray-300 shadow-inner leading-relaxed">
                {loading && logs.length === 0 ? (
                    <div className="text-center py-6 text-gray-600">Connecting to compliance ledger...</div>
                ) : recentLogs.length === 0 ? (
                    <div className="text-center py-6 text-gray-600">No operations recorded.</div>
                ) : (
                    <div className="space-y-1.5">
                        {recentLogs.map(log => (
                            <div key={log.id} className="flex flex-col sm:flex-row sm:items-start gap-2 py-0.5 border-b border-gray-900/50 hover:bg-gray-900/40 px-1 rounded transition-colors text-left">
                                <span className="text-gray-500 shrink-0">{log.timestamp}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 text-center uppercase ${getActionBadgeColor(log.action)}`}>
                                    {log.action}
                                </span>
                                <span className="text-blue-400 font-bold shrink-0">[{log.exception_id}]</span>
                                <span className="text-emerald-500 shrink-0">({log.operator}):</span>
                                <span className="text-gray-200 truncate max-w-md">{log.details}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Trigger Button */}
            <button
                onClick={() => setIsDrawerOpen(true)}
                className="mt-3 w-full py-2.5 bg-gray-900 hover:bg-gray-850 border border-gray-800 text-gray-300 hover:text-white rounded text-xs font-semibold font-mono tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
            >
                ▶ VIEW FULL LEDGER CONSOLE ({totalCount} EVENTS)
            </button>

            {/* Side Drawer Console */}
            {isDrawerOpen && (
                <>
                    {/* Dark Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity" 
                        onClick={() => setIsDrawerOpen(false)}
                    />
                    
                    {/* Drawer Panel */}
                    <div className="fixed right-0 top-0 h-full w-full sm:w-[640px] bg-gray-950 shadow-2xl z-50 border-l border-gray-800 flex flex-col font-mono text-left text-gray-300">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-gray-900/40">
                            <div>
                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Enterprise Audit Console</span>
                                <h3 className="text-base font-bold text-white flex items-center gap-2 mt-0.5">
                                    Immutable Transaction Ledger
                                    <span className="text-[9px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded border border-gray-700">
                                        {drawerTotalCount} Records
                                    </span>
                                </h3>
                            </div>
                            <button 
                                onClick={() => setIsDrawerOpen(false)} 
                                className="p-1 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-850 transition-all font-bold text-lg font-sans cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search & Filters */}
                        <div className="p-4 bg-gray-900/10 border-b border-gray-900 flex flex-col gap-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <input
                                    type="text"
                                    placeholder="Search by ID, operator, details..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="sm:col-span-2 text-xs px-3 py-2 border border-gray-850 rounded bg-gray-900/60 text-gray-300 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                <select
                                    value={actionFilter}
                                    onChange={(e) => setActionFilter(e.target.value)}
                                    className="text-xs px-3 py-2 border border-gray-850 rounded bg-gray-900/60 text-gray-350 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value="">All Operations</option>
                                    <option value="CREATED">CREATED</option>
                                    <option value="UPDATED">UPDATED</option>
                                    <option value="IMPORTED">IMPORTED</option>
                                    <option value="RENEWED">RENEWED</option>
                                    <option value="REVOKED">REVOKED</option>
                                    <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                                </select>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-500 px-1">
                                <span>Showing {drawerLogs.length} of {drawerTotalCount} entries</span>
                                <button
                                    onClick={() => setLocalRefreshTrigger(p => p + 1)}
                                    className="text-blue-500 hover:underline cursor-pointer"
                                >
                                    Force Sync Ledger
                                </button>
                            </div>
                        </div>

                        {/* Full scrollable console body */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 select-text scrollbar-thin">
                            {loadingDrawer && drawerLogs.length === 0 ? (
                                <div className="text-center py-12 text-gray-600 text-xs">Syncing active ledger...</div>
                            ) : drawerLogs.length === 0 ? (
                                <div className="text-center py-12 text-gray-600 text-xs">No records found matching filters.</div>
                            ) : (
                                drawerLogs.map(log => (
                                    <div 
                                        key={log.id} 
                                        className="flex flex-col text-[11px] py-2 border-b border-gray-900/40 hover:bg-gray-900/30 px-2 rounded transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="text-gray-500">{log.timestamp}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase shrink-0 text-center ${getActionBadgeColor(log.action)}`}>
                                                {log.action}
                                            </span>
                                            <span className="text-blue-400 font-bold">[{log.exception_id}]</span>
                                            <span className="text-emerald-500 font-semibold">({log.operator})</span>
                                        </div>
                                        <span className="text-gray-300 leading-normal pl-1">{log.details}</span>
                                    </div>
                                ))
                            )}

                            {drawerPage < drawerTotalPages && (
                                <button
                                    onClick={handleLoadMoreDrawer}
                                    disabled={loadingDrawer}
                                    className="w-full py-2.5 bg-gray-900 hover:bg-gray-850 text-gray-350 hover:text-white rounded border border-gray-800 text-[10px] font-bold uppercase tracking-wider transition-all mt-2 cursor-pointer text-center disabled:opacity-50"
                                >
                                    {loadingDrawer ? "Loading..." : "Load More (+50 events)"}
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
