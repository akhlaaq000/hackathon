import React from "react";

export const RegulatoryFrameworks: React.FC = () => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8 font-sans">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                        Regulatory Framework Mapping
                    </h2>

                    <p className="text-sm text-gray-500 mt-1">
                        Alignment telemetry mapping Policy Exception Registry engine
                        rules to strict regulatory compliance standards.
                    </p>
                </div>

                <div className="flex gap-2">
                    <span className="px-2.5 py-1 bg-green-50 text-green-700 text-xs font-bold rounded-full border border-green-200 uppercase tracking-wide">
                        Audit Ready
                    </span>

                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-200 uppercase tracking-wide">
                        3/3 Aligned
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* NIST */}
                <div className="border border-gray-200 rounded-lg p-5 bg-gray-50/10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                            <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">
                                NIST SP 800-53
                            </span>

                            <span className="text-[10px] text-gray-400 font-bold">
                                AC-2 &amp; PL-4
                            </span>
                        </div>

                        <h4 className="text-xs font-bold text-gray-800 uppercase">
                            Account Management Rules
                        </h4>

                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                            <strong>Requirement:</strong> All deviations from
                            standard access controls must be formally documented,
                            authorized, and reviewed.
                        </p>

                        <div className="mt-3 p-3 bg-white border border-gray-200 rounded text-xs text-gray-600 leading-relaxed">
                            <strong>Platform Controls:</strong> Ingests all
                            privilege access exceptions (ADMIN_ACCESS,
                            ROOT_ACCESS) in a central repository, scans for
                            expired admin keys, and escalates risks in the
                            engine.
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center text-[10px]">
                        <span className="text-gray-400 font-semibold uppercase">
                            Framework Status
                        </span>

                        <span className="px-2 py-0.5 bg-green-100 text-green-800 font-bold rounded">
                            AC-2 COMPLIANT
                        </span>
                    </div>
                </div>

                {/* GDPR */}
                <div className="border border-gray-200 rounded-lg p-5 bg-gray-50/10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                            <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">
                                GDPR Article 25
                            </span>

                            <span className="text-[10px] text-gray-400 font-bold">
                                Privacy by Design
                            </span>
                        </div>

                        <h4 className="text-xs font-bold text-gray-800 uppercase">
                            Waiver Expirations &amp; Justification
                        </h4>

                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                            <strong>Requirement:</strong> Forgotten exceptions
                            actively undermine privacy. Waivers must be strictly
                            temporary, heavily justified, and monitored.
                        </p>

                        <div className="mt-3 p-3 bg-white border border-gray-200 rounded text-xs text-gray-600 leading-relaxed">
                            <strong>Platform Controls:</strong> Rules penalize
                            vague justifications (e.g. "business need"), detect
                            Zombie Exceptions (&gt; 2 years active), and require
                            manual reviews to renew waivers.
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center text-[10px]">
                        <span className="text-gray-400 font-semibold uppercase">
                            Framework Status
                        </span>

                        <span className="px-2 py-0.5 bg-green-100 text-green-800 font-bold rounded">
                            DESIGN ENFORCED
                        </span>
                    </div>
                </div>

                {/* CIS */}
                <div className="border border-gray-200 rounded-lg p-5 bg-gray-50/10 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-3">
                            <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">
                                CIS Controls 1.1
                            </span>

                            <span className="text-[10px] text-gray-400 font-bold">
                                Inventory Control
                            </span>
                        </div>

                        <h4 className="text-xs font-bold text-gray-800 uppercase">
                            Trackable Exception Assets
                        </h4>

                        <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                            <strong>Requirement:</strong> Exceptions must be
                            treated as formal, trackable IT assets within a
                            unified inventory dashboard.
                        </p>

                        <div className="mt-3 p-3 bg-white border border-gray-200 rounded text-xs text-gray-600 leading-relaxed">
                            <strong>Platform Controls:</strong> Active database
                            registry enables searching, sorting, and reporting on
                            active high-risk exceptions with custom heatmaps and
                            stacked charts.
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center text-[10px]">
                        <span className="text-gray-400 font-semibold uppercase">
                            Framework Status
                        </span>

                        <span className="px-2 py-0.5 bg-green-100 text-green-800 font-bold rounded">
                            INVENTORY ACTIVE
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
};