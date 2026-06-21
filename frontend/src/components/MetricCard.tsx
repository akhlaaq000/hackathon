import React from 'react';

interface MetricCardProps {
    title: string;
    value: string | number;
    valueColorClass?: string;
    borderColorClass?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
    title,
    value,
    valueColorClass = 'text-gray-900',
    borderColorClass = 'border-gray-100',
}) => {
    return (
        <div className={`bg-white p-6 rounded-lg shadow-sm border ${borderColorClass}`}>
            <h3 className="text-sm font-medium text-gray-500">{title}</h3>
            <p className={`text-3xl font-bold ${valueColorClass}`}>{value}</p>
        </div>
    );
};
