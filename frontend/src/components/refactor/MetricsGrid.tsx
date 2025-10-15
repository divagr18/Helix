// src/components/refactor/MetricsGrid.tsx
import React from 'react';
import { type CodeSymbol } from '@/types';
import { MetricCard } from './MetricCard';
import {
    TrendingUp, FileText, TestTube, Activity, Shield, Gauge, Clock, AlertTriangle
} from 'lucide-react';

interface MetricsGridProps {
    symbol: CodeSymbol;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ symbol }) => {
    // Mock data for metrics not yet in our model
    const performanceScore = 6.2;
    const maintainabilityIndex = 65;
    const bugPotential = "Medium";
    const testCoverage = 78; // Assuming this will come from the symbol or a related model

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <MetricCard title="Complexity" value={symbol.cyclomatic_complexity || 0} icon={TrendingUp} valueColor="text-red-400" />
            <MetricCard title="Lines" value={symbol.loc || 0} icon={FileText} />
            <MetricCard title="Coverage" value={`${testCoverage}%`} icon={TestTube} valueColor="text-yellow-400" />
            <MetricCard title="Performance" value={performanceScore} icon={Activity} valueColor="text-orange-400" />
            <MetricCard title="Maintainability" value={maintainabilityIndex} icon={Gauge} valueColor="text-blue-400" />
            <MetricCard title="Bug Risk" value={bugPotential} icon={AlertTriangle} valueColor="text-yellow-400" />
        </div>
    );
};