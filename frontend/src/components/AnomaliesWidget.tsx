import React, { useState, useEffect } from 'react';
import { Anomaly } from '../types';
import { API_BASE_URL } from '../config';

interface AnomaliesWidgetProps {
    refreshTrigger: number;
}

export const AnomaliesWidget: React.FC<AnomaliesWidgetProps> = ({ refreshTrigger }) => {
    const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
    const [loading, setLoading] = useState(true);
    const [severityFilter, setSeverityFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Drawer-specific state
    const [drawerAnomalies, setDrawerAnomalies] = useState<Anomaly[]>([]);
    const [drawerPage, setDrawerPage] = useState(1);
    const [drawerTotalPages, setDrawerTotalPages] = useState(1);
    const [drawerTotalCount, setDrawerTotalCount] = useState(0);
    const [loadingDrawer, setLoadingDrawer] = useState(false);

    // Fetch compact dashboard preview (Top 5)
    const fetchAnomalies = () => {
        setLoading(true);
        fetch(`${API_BASE_URL}/api/anomalies?page=1&size=5`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch anomalies");
                return res.json();
            })
            .then((data) => {
                setAnomalies(data.items);
                setTotalCount(data.total);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Anomalies fetch error:", err);
                setLoading(false);
            });
    };

    // Fetch paginated data for the drawer
    const fetchDrawerAnomalies = (page: number, append: boolean) => {
        setLoadingDrawer(true);
        const params = new URLSearchParams({
            page: page.toString(),
            size: '50'
        });
        if (searchQuery) params.append('search', searchQuery);
        if (severityFilter) params.append('severity', severityFilter);

        fetch(`${API_BASE_URL}/api/anomalies?${params.toString()}`)
            .then((res) => {
                if (!res.ok) throw new Error("Failed to fetch drawer anomalies");
                return res.json();
            })
            .then((data) => {
                if (append) {
                    setDrawerAnomalies((prev) => [...prev, ...data.items]);
                } else {
                    setDrawerAnomalies(data.items);
                }
                setDrawerPage(data.page);
                setDrawerTotalPages(data.pages);
                setDrawerTotalCount(data.total);
                setLoadingDrawer(false);
            })
            .catch((err) => {
                console.error("Drawer anomalies fetch error:", err);
                setLoadingDrawer(false);
            });
    };

    // Refresh compact view on parent refresh trigger
    useEffect(() => {
        fetchAnomalies();
    }, [refreshTrigger]);

    // Handle drawer anomalies fetching based on filters and visibility
    useEffect(() => {
        if (isDrawerOpen) {
            fetchDrawerAnomalies(1, false);
        }
    }, [searchQuery, severityFilter, isDrawerOpen, refreshTrigger]);

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
            fetchDrawerAnomalies(drawerPage + 1, true);
        }
    };

    const getSeverityBadgeStyles = (severity: string) => {
        const s = severity.toUpperCase();
        if (s === 'CRITICAL') {
            return 'bg-red-100 text-red-800 border-red-200';
        } else if (s === 'HIGH') {
            return 'bg-orange-100 text-orange-800 border-orange-200';
        } else {
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        }
    };

    const getAnomalyCardBorderStyles = (severity: string) => {
        const s = severity.toUpperCase();
        if (s === 'CRITICAL') {
            return 'border-l-4 border-l-red-600 border-red-100';
        } else if (s === 'HIGH') {
            return 'border-l-4 border-l-orange-500 border-orange-100';
        } else {
            return 'border-l-4 border-l-yellow-500 border-yellow-100';
        }
    };

    const recentAnomalies = anomalies;

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8 font-sans">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-5 gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <span>Security &amp; Compliance Anomalies</span>
                        {!loading && totalCount > 0 && (
                            <span className="text-xs px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full font-bold">
                                {totalCount} Active Policy Violations
                            </span>
                        )}
                    </h2>
                    <p className="text-sm text-gray-500">Live scanning of active exceptions for policy and risk deviations</p>
                </div>
            </div>

            {/* Compact Preview List (Top 5) */}
            {loading ? (
                <div className="py-6 text-center text-gray-400 text-sm">
                    Scanning exceptions database for anomalies...
                </div>
            ) : recentAnomalies.length > 0 ? (
                <div className="space-y-3">
                    {recentAnomalies.map((a, idx) => (
                        <div 
                            key={`${a.exception_id || 'global'}-${a.anomaly_type}-${idx}`} 
                            className={`p-3.5 bg-white border rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-left ${getAnomalyCardBorderStyles(a.severity)}`}
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase border ${getSeverityBadgeStyles(a.severity)}`}>
                                        {a.severity}
                                    </span>
                                    <span className="text-xs font-semibold text-gray-900 font-mono">
                                        {a.anomaly_type}
                                    </span>
                                    {a.exception_id && (
                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded font-mono font-medium">
                                            ID: {a.exception_id}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-650 leading-relaxed mt-0.5">{a.description}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-[10px] text-gray-400 block">Detected: {a.date_detected}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="py-8 text-center text-gray-400 text-sm border border-dashed border-gray-250 rounded-lg">
                    Great! No security or compliance anomalies detected in the database registry.
                </div>
            )}

            {/* View Full Feed Trigger Button */}
            <button
                onClick={() => setIsDrawerOpen(true)}
                className="mt-4 w-full py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 text-gray-700 hover:text-gray-900 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
            >
                ⚠️ VIEW ALL POLICY VIOLATIONS ({totalCount} ALERTS)
            </button>

            {/* Side Drawer Console for Anomalies */}
            {isDrawerOpen && (
                <>
                    {/* Dark Backdrop */}
                    <div 
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 transition-opacity" 
                        onClick={() => setIsDrawerOpen(false)}
                    />
                    
                    {/* Drawer Panel */}
                    <div className="fixed right-0 top-0 h-full w-full sm:w-[640px] bg-white shadow-2xl z-50 border-l border-gray-200 flex flex-col font-sans text-left text-gray-700">
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-gray-150 flex items-center justify-between bg-gray-50">
                            <div>
                                <span className="text-[10px] font-bold text-red-600 uppercase tracking-widest">Waiver Compliance Feed</span>
                                <h3 className="text-base font-bold text-gray-950 flex items-center gap-2 mt-0.5">
                                    Triggered Security Anomalies
                                    <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-800 rounded-full font-bold">
                                        {drawerTotalCount} Active
                                    </span>
                                </h3>
                            </div>
                            <button 
                                onClick={() => setIsDrawerOpen(false)} 
                                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all font-bold text-lg cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Search & Filters */}
                        <div className="p-4 bg-gray-50/50 border-b border-gray-150 flex flex-col gap-3">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    placeholder="Search anomalies by ID, requester, or description..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full sm:w-2/3 text-xs px-3 py-2 border border-gray-250 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                />
                                <select
                                    value={severityFilter}
                                    onChange={(e) => setSeverityFilter(e.target.value)}
                                    className="w-full sm:w-1/3 text-xs px-3 py-2 border border-gray-250 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                >
                                    <option value="">All Severities</option>
                                    <option value="CRITICAL">CRITICAL</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                </select>
                            </div>
                            <div className="text-[10px] text-gray-500 px-1">
                                Showing {drawerAnomalies.length} of {drawerTotalCount} active policy deviations
                            </div>
                        </div>

                        {/* Full scrollable list */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
                            {loadingDrawer && drawerAnomalies.length === 0 ? (
                                <div className="py-12 text-center text-gray-400 text-xs">Scanning registry...</div>
                            ) : drawerAnomalies.length > 0 ? (
                                <>
                                    {drawerAnomalies.map((a, idx) => (
                                        <div 
                                            key={`${a.exception_id || 'global'}-${a.anomaly_type}-${idx}`} 
                                            className={`p-4 bg-white border rounded-lg shadow-sm hover:shadow-md transition-all flex flex-col gap-3 ${getAnomalyCardBorderStyles(a.severity)}`}
                                        >
                                            <div className="flex flex-col gap-1.5 text-left">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase border ${getSeverityBadgeStyles(a.severity)}`}>
                                                        {a.severity}
                                                    </span>
                                                    <span className="text-xs font-semibold text-gray-900 font-mono">
                                                        {a.anomaly_type}
                                                    </span>
                                                    {a.exception_id && (
                                                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-mono font-medium">
                                                            ID: {a.exception_id}
                                                        </span>
                                                    )}
                                                    {a.requester && (
                                                        <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium">
                                                            Requester: {a.requester}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-700 leading-relaxed font-medium mt-1">{a.description}</p>
                                            </div>
                                            <div className="flex justify-between items-center border-t border-gray-100 pt-2.5 text-[10px] text-gray-400">
                                                <span>Scan Source: Real-time Compliance Engine</span>
                                                <span className="font-mono font-medium">Detected: {a.date_detected}</span>
                                            </div>
                                        </div>
                                    ))}

                                    {drawerPage < drawerTotalPages && (
                                        <button
                                            onClick={handleLoadMoreDrawer}
                                            disabled={loadingDrawer}
                                            className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-250 text-gray-700 hover:text-gray-950 rounded text-xs font-semibold uppercase tracking-wider transition-all mt-3 cursor-pointer text-center disabled:opacity-50"
                                        >
                                            {loadingDrawer ? "Loading..." : "Load More (+50 alerts)"}
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="py-12 text-center text-gray-400 text-xs border border-dashed border-gray-250 rounded-lg">
                                    No policy violations match your search parameters.
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
