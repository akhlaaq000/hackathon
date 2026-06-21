import React from 'react';

interface SystemStatusProps {
    statusText: string;
    bgColorClass?: string;
    textColorClass?: string;
    borderColorClass?: string;
}

export const SystemStatus: React.FC<SystemStatusProps> = ({
    statusText,
    bgColorClass = 'bg-blue-50',
    textColorClass = 'text-blue-800',
    borderColorClass = 'border-blue-200',
}) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">System Status</h2>
            <div className={`p-4 rounded border ${bgColorClass} ${textColorClass} ${borderColorClass}`}>
                {statusText}
            </div>
        </div>
    );
};
