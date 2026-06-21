import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

interface ApproverStats {
    approver: string;
    counts: {
        CRITICAL: number;
        HIGH: number;
        MEDIUM: number;
        LOW: number;
    };
    total: number;
}

interface HeatmapStats {
    type: string;
    counts: {
        CRITICAL: number;
        HIGH: number;
        MEDIUM: number;
        LOW: number;
    };
    total: number;
}

interface TrendPoint {
    month: string;
    created: number;
    cumulative: number;
}

interface InsightsData {
    approver_distribution: ApproverStats[];
    heatmap: HeatmapStats[];
    trend?: TrendPoint[];
}

const normalizeTypeFrontend = (t: string): string => {
    if (!t) return 'DEV_ENV';
    const tLower = t.toLowerCase().trim();
    if (tLower.includes('admin') || tLower.includes('sudo') || tLower.includes('privilege') || tLower.includes('elevated') || tLower.includes('sysadmin') || tLower.includes('dba') || tLower.includes('superuser') || tLower.includes('breakglass') || tLower.includes('break glass') || tLower.includes('sa account') || tLower.includes('god mode') || tLower.includes('local admin') || tLower.includes('root') || tLower.includes('owner')) {
        return 'ADMIN_ACCESS';
    }
    if (tLower.includes('encrypt') || tLower.includes('crypt') || tLower.includes('tls') || tLower.includes('ssl') || tLower.includes('cipher') || tLower.includes('certificate') || tLower.includes('cert')) {
        return 'ENCRYPTION_WAIVER';
    }
    if (tLower.includes('firewall') || tLower.includes('port') || tLower.includes('network') || tLower.includes('acl') || tLower.includes('sg') || tLower.includes('security group') || tLower.includes('ingress') || tLower.includes('egress') || tLower.includes('vpn') || tLower.includes('allowlist') || tLower.includes('whitelist') || tLower.includes('waf') || tLower.includes('proxy') || tLower.includes('routing') || tLower.includes('ips') || tLower.includes('ids')) {
        return 'FIREWALL_RULE';
    }
    if (tLower.includes('data') || tLower.includes('export') || tLower.includes('pii') || tLower.includes('phi') || tLower.includes('dlp') || tLower.includes('download') || tLower.includes('query') || tLower.includes('read-only') || tLower.includes('sql access')) {
        return 'DATA_ACCESS';
    }
    return 'DEV_ENV';
};

interface PortfolioInsightsProps {
    refreshTrigger: number;
}

export const PortfolioInsights: React.FC<PortfolioInsightsProps> = ({ refreshTrigger }) => {
    const [insights, setInsights] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [hoveredCell, setHoveredCell] = useState<{ type: string; risk: string; count: number } | null>(null);
    const [hoveredBarSegment, setHoveredBarSegment] = useState<{ approver: string; risk: string; count: number } | null>(null);

    const fetchInsights = () => {
        setLoading(true);
        fetch(`${API_BASE_URL}/api/dashboard/insights`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch insights");
                return res.json();
            })
            .then(data => {
                // Aggregate and normalize to exactly the 5 canonical categories on the frontend
                const aggregatedHeatmap: { [key: string]: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number } } = {
                    ADMIN_ACCESS: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
                    DATA_ACCESS: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
                    ENCRYPTION_WAIVER: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
                    FIREWALL_RULE: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
                    DEV_ENV: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
                };

                if (data && Array.isArray(data.heatmap)) {
                    data.heatmap.forEach((h: any) => {
                        const normType = normalizeTypeFrontend(h.type);
                        if (aggregatedHeatmap[normType]) {
                            aggregatedHeatmap[normType].CRITICAL += h.counts?.CRITICAL || 0;
                            aggregatedHeatmap[normType].HIGH += h.counts?.HIGH || 0;
                            aggregatedHeatmap[normType].MEDIUM += h.counts?.MEDIUM || 0;
                            aggregatedHeatmap[normType].LOW += h.counts?.LOW || 0;
                        }
                    });
                }

                const heatmapStats: HeatmapStats[] = Object.keys(aggregatedHeatmap).map(type => ({
                    type,
                    counts: aggregatedHeatmap[type],
                    total: Object.values(aggregatedHeatmap[type]).reduce((sum, val) => sum + val, 0)
                }));

                setInsights({
                    ...data,
                    heatmap: heatmapStats
                });
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchInsights();
    }, [refreshTrigger]);

    if (loading) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8 font-sans">
                <h2 className="text-xl font-semibold text-gray-900">Portfolio Risk Insights</h2>
                <div className="py-12 text-center text-gray-400 text-sm">
                    Analyzing active waivers and compiling risk distributions...
                </div>
            </div>
        );
    }

    if (!insights || (insights.approver_distribution.length === 0 && insights.heatmap.length === 0)) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8 font-sans">
                <h2 className="text-xl font-semibold text-gray-900 font-sans">Portfolio Risk Insights</h2>
                <p className="text-sm text-gray-500 mt-1">Live visualization of exception ownership and density</p>
                <div className="py-12 text-center text-gray-400 text-sm">
                    No active exception records available to visualize. Upload a CSV file above to populate the dashboard.
                </div>
            </div>
        );
    }

    // Stacked chart settings
    const maxBarTotal = Math.max(...insights.approver_distribution.map(a => a.total), 1);

    // Heatmap settings
    const riskLevels = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    
    // Get unique exception types from heatmap or fallback to common ones
    const exceptionTypes = insights.heatmap.length > 0 
        ? insights.heatmap.map(h => h.type)
        : ['ADMIN_ACCESS', 'ROOT_ACCESS', 'DATA_EXPORT', 'NETWORK_RULE'];

    // Helper for rendering cell background intensities
    const getCellColor = (risk: string, count: number) => {
        if (count === 0) return '#f9fafb'; // neutral light gray
        
        // Intensify opacity as count increases
        const intensity = Math.min(0.15 + (count * 0.15), 1.0);
        
        switch (risk) {
            case 'CRITICAL':
                return `rgba(239, 68, 68, ${intensity})`; // Red
            case 'HIGH':
                return `rgba(249, 115, 22, ${intensity})`; // Orange
            case 'MEDIUM':
                return `rgba(234, 179, 8, ${intensity})`; // Yellow
            case 'LOW':
                return `rgba(34, 197, 94, ${intensity})`; // Green
            default:
                return '#f9fafb';
        }
    };

    const getCellTextColor = (count: number) => {
        if (count === 0) return 'text-gray-300';
        return 'text-gray-900 font-bold';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8 font-sans">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Portfolio Risk Insights</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Visual telemetry mapping security risk density across exception types and authorized approvers.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* WIDGET 1: Stacked Bar Chart by Approver */}
                <div className="lg:col-span-6 border border-gray-150 p-5 rounded-lg bg-gray-50/20">
                    <div className="flex justify-between items-center mb-5">
                        <div>
                            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Risk Accumulation</span>
                            <h3 className="text-sm font-semibold text-gray-800 mt-0.5">Exceptions Count by Approver</h3>
                        </div>
                        {/* Custom Legend */}
                        <div className="flex gap-2 text-[10px] font-bold">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500"></span>C</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-500"></span>H</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-500"></span>M</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500"></span>L</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {insights.approver_distribution.map(a => {
                            // Calculate total width of the bar (relative to the maximum approver total)
                            const barRelativeWidth = (a.total / maxBarTotal) * 100;
                            
                            return (
                                <div key={a.approver} className="space-y-1">
                                    <div className="flex justify-between text-xs font-medium text-gray-700">
                                        <span>{a.approver}</span>
                                        <span className="text-gray-400 font-semibold">{a.total} active</span>
                                    </div>
                                    <div className="h-5 w-full bg-gray-100 rounded overflow-hidden flex">
                                        <div 
                                            style={{ width: `${barRelativeWidth}%` }} 
                                            className="h-full flex"
                                        >
                                            {/* Stacked bar segments */}
                                            {riskLevels.map(risk => {
                                                const count = a.counts[risk as keyof typeof a.counts] || 0;
                                                if (count === 0) return null;
                                                const segmentWidth = (count / a.total) * 100;
                                                
                                                let bgColor = 'bg-green-500';
                                                if (risk === 'CRITICAL') bgColor = 'bg-red-500';
                                                else if (risk === 'HIGH') bgColor = 'bg-orange-500';
                                                else if (risk === 'MEDIUM') bgColor = 'bg-yellow-500';

                                                return (
                                                    <div
                                                        key={risk}
                                                        style={{ width: `${segmentWidth}%` }}
                                                        className={`${bgColor} h-full cursor-pointer transition-all hover:brightness-90 hover:scale-y-110 relative`}
                                                        onMouseEnter={() => setHoveredBarSegment({ approver: a.approver, risk, count })}
                                                        onMouseLeave={() => setHoveredBarSegment(null)}
                                                    ></div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Bar Tooltip */}
                    <div className="mt-4 h-6 text-xs text-gray-500 italic flex items-center justify-center border-t border-gray-150 pt-3">
                        {hoveredBarSegment ? (
                            <span>
                                <strong>{hoveredBarSegment.approver}</strong>: {hoveredBarSegment.count} <strong>{hoveredBarSegment.risk}</strong> exception{hoveredBarSegment.count > 1 ? 's' : ''} approved
                            </span>
                        ) : (
                            <span>Hover over colored segments to view risk totals.</span>
                        )}
                    </div>
                </div>

                {/* WIDGET 2: Risk Heatmap Matrix */}
                <div className="lg:col-span-6 border border-gray-150 p-5 rounded-lg bg-gray-50/20">
                    <div className="mb-5">
                        <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Risk Density Grid</span>
                        <h3 className="text-sm font-semibold text-gray-800 mt-0.5">Exceptions Type vs Risk Levels</h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr>
                                    <th className="p-1.5 text-left text-[10px] font-bold text-gray-400 uppercase">Risk Level</th>
                                    {exceptionTypes.map(t => (
                                        <th key={t} className="p-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-tight max-w-[80px] truncate" title={t}>
                                            {t.replace('_', '\n')}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {riskLevels.map(risk => {
                                    return (
                                        <tr key={risk}>
                                            <td className="p-1.5 text-left text-xs font-semibold text-gray-700 uppercase tracking-tight">
                                                {risk}
                                            </td>
                                            {exceptionTypes.map(t => {
                                                const typeData = insights.heatmap.find(h => h.type === t);
                                                const count = typeData?.counts[risk as keyof typeof typeData.counts] || 0;
                                                const cellBg = getCellColor(risk, count);
                                                
                                                return (
                                                    <td key={t} className="p-1">
                                                        <div
                                                            style={{ backgroundColor: cellBg }}
                                                            className={`h-9 w-full flex items-center justify-center rounded text-xs transition-all cursor-crosshair border border-gray-200/20 hover:ring-2 hover:ring-blue-500 ${getCellTextColor(count)}`}
                                                            onMouseEnter={() => setHoveredCell({ type: t, risk, count })}
                                                            onMouseLeave={() => setHoveredCell(null)}
                                                        >
                                                            {count}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Heatmap Tooltip */}
                    <div className="mt-4 h-6 text-xs text-gray-500 italic flex items-center justify-center border-t border-gray-150 pt-3">
                        {hoveredCell ? (
                            <span>
                                <strong>{hoveredCell.type}</strong>: {hoveredCell.count} active <strong>{hoveredCell.risk}</strong> waiver{hoveredCell.count !== 1 ? 's' : ''}
                            </span>
                        ) : (
                            <span>Hover over cells to inspect risk volume in detail.</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Historical Exception Creep Trend Analysis */}
            <TrendChart data={insights.trend || []} />
        </div>
    );
};

const formatMonth = (monthStr: string) => {
    if (!monthStr) return "";
    const parts = monthStr.split('-');
    if (parts.length < 2) return monthStr;
    const [year, month] = parts;
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('default', { month: 'short', year: 'numeric' });
};

interface TrendChartProps {
    data: TrendPoint[];
}

const TrendChart: React.FC<TrendChartProps> = ({ data }) => {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    if (!data || data.length === 0) return null;

    const width = 1000;
    const height = 220;
    const paddingLeft = 50;
    const paddingRight = 30;
    const paddingTop = 20;
    const paddingBottom = 35;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Find max values for scaling
    const maxCumulative = Math.max(...data.map(d => d.cumulative), 1);

    // Compute coordinates
    const points = data.map((d, index) => {
        const x = paddingLeft + (index / (data.length - 1 || 1)) * chartWidth;
        // Map cumulative value to Y
        const y = paddingTop + chartHeight - (d.cumulative / maxCumulative) * chartHeight;
        // Map created value to Y for bar height
        const barHeight = (d.created / maxCumulative) * chartHeight;
        
        return { x, y, barHeight, d };
    });

    // Construct line path
    let linePath = '';
    let areaPath = '';
    if (points.length > 0) {
        linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    }

    return (
        <div className="relative w-full border border-gray-150 p-5 rounded-lg bg-gray-50/20 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
                <div>
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Exception Creep Trend</span>
                    <h3 className="text-sm font-semibold text-gray-850 mt-0.5">Waiver Accumulation Analysis (Timeline Growth)</h3>
                </div>
                {/* Legend */}
                <div className="flex gap-4 text-[10px] font-bold text-gray-600">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-0.5 bg-blue-500 inline-block relative bottom-[1px]"></span>
                        Cumulative Active Exceptions
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded bg-gray-300 inline-block"></span>
                        Monthly New Waiver Registrations
                    </span>
                </div>
            </div>

            {/* SVG Chart Wrapper */}
            <div className="relative w-full overflow-x-auto">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[700px] overflow-visible">
                    <defs>
                        {/* Area Gradient */}
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                        </linearGradient>
                        {/* Line glow filter */}
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="2.5" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>

                    {/* Y-Axis Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                        const y = paddingTop + ratio * chartHeight;
                        const labelValue = Math.round(maxCumulative - ratio * maxCumulative);
                        return (
                            <g key={i} className="opacity-40">
                                <line 
                                    x1={paddingLeft} 
                                    y1={y} 
                                    x2={width - paddingRight} 
                                    y2={y} 
                                    stroke="#e5e7eb" 
                                    strokeWidth="1" 
                                    strokeDasharray="4 4"
                                />
                                <text 
                                    x={paddingLeft - 10} 
                                    y={y + 4} 
                                    textAnchor="end" 
                                    className="text-[10px] fill-gray-400 font-mono"
                                >
                                    {labelValue}
                                </text>
                            </g>
                        );
                    })}

                    {/* Render monthly bar charts for 'new exceptions' */}
                    {points.map((p, idx) => {
                        const barWidth = Math.min(18, Math.max(8, chartWidth / points.length * 0.3));
                        return (
                            <rect
                                key={`bar-${idx}`}
                                x={p.x - barWidth / 2}
                                y={height - paddingBottom - p.barHeight}
                                width={barWidth}
                                height={p.barHeight}
                                fill="#e5e7eb"
                                rx="1.5"
                                className="transition-all duration-300 hover:fill-blue-200"
                            />
                        );
                    })}

                    {/* Gradient Area under Cumulative Line */}
                    {areaPath && (
                        <path d={areaPath} fill="url(#areaGrad)" />
                    )}

                    {/* Cumulative Line Path */}
                    {linePath && (
                        <path 
                            d={linePath} 
                            fill="none" 
                            stroke="#3b82f6" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            filter="url(#glow)"
                        />
                    )}

                    {/* X-Axis labels */}
                    {points.map((p, idx) => {
                        // Decimate labels if too many to prevent overlapping
                        const step = Math.ceil(points.length / 12);
                        if (idx % step !== 0 && idx !== points.length - 1) return null;
                        
                        return (
                            <g key={`lbl-${idx}`} className="text-[10px] fill-gray-400 font-sans">
                                <line 
                                    x1={p.x} 
                                    y1={height - paddingBottom} 
                                    x2={p.x} 
                                    y2={height - paddingBottom + 5} 
                                    stroke="#e5e7eb" 
                                />
                                <text 
                                    x={p.x} 
                                    y={height - paddingBottom + 18} 
                                    textAnchor="middle"
                                >
                                    {formatMonth(p.d.month)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Highlight and Tooltip triggers */}
                    {points.map((p, idx) => (
                        <g 
                            key={`pt-${idx}`}
                            onMouseEnter={() => setHoveredIndex(idx)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            className="cursor-pointer"
                        >
                            {/* Invisible thick vertical bar for easier hover selection */}
                            <rect
                                x={p.x - (chartWidth / (points.length - 1 || 1)) / 2}
                                y={paddingTop}
                                width={chartWidth / (points.length - 1 || 1)}
                                height={chartHeight}
                                fill="transparent"
                            />
                            {/* Hover line */}
                            {hoveredIndex === idx && (
                                <line
                                    x1={p.x}
                                    y1={paddingTop}
                                    x2={p.x}
                                    y2={height - paddingBottom}
                                    stroke="#3b82f6"
                                    strokeWidth="1.5"
                                    strokeDasharray="3 3"
                                    className="pointer-events-none"
                                />
                            )}
                            {/* Point circle */}
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={hoveredIndex === idx ? 5.5 : 3.5}
                                fill="#ffffff"
                                stroke="#3b82f6"
                                strokeWidth={hoveredIndex === idx ? 2.5 : 1.5}
                                className="transition-all duration-150 pointer-events-none"
                            />
                        </g>
                    ))}
                </svg>
            </div>

            {/* Hover Tooltip display at bottom */}
            <div className="h-6 text-xs text-gray-500 italic flex items-center justify-center border-t border-gray-150 pt-3 mt-2">
                {hoveredIndex !== null && data[hoveredIndex] ? (
                    <span className="text-gray-800 not-italic font-medium">
                        🗓️ <strong className="text-blue-600 font-bold">{formatMonth(data[hoveredIndex].month)}</strong>:
                        <span className="ml-3 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-mono font-bold">+{data[hoveredIndex].created}</span> New Waiver{data[hoveredIndex].created !== 1 ? 's' : ''} 
                        <span className="ml-3 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-full font-mono font-extrabold">{data[hoveredIndex].cumulative}</span> Cumulative active waivers
                    </span>
                ) : (
                    <span>Hover over data points to inspect exception creep and historical velocity.</span>
                )}
            </div>
        </div>
    );
};
