// src/components/refactor/ImpactSummaryCard.tsx
import React, { useMemo } from 'react';
import { type CodeSymbol, type RefactoringSuggestion } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BarChart3 } from 'lucide-react';

interface ImpactSummaryCardProps {
    symbol: CodeSymbol;
    suggestions: RefactoringSuggestion[];
}

export const ImpactSummaryCard: React.FC<ImpactSummaryCardProps> = ({ symbol, suggestions }) => {
    const impactData = useMemo(() => {
        const totalComplexityReduction = suggestions.reduce(
            (sum, s) => sum + s.complexity_reduction,
            0
        );

        // Mocked values for now
        const totalLinesReduced = suggestions.reduce(
            (sum, s) => sum + s.complexity_reduction * 2,
            0
        );
        const newMaintainability = 78;

        const initialComplexity = symbol.cyclomatic_complexity || 1;
        const complexityReductionPercentage =
            (Math.abs(totalComplexityReduction) / initialComplexity) * 100;

        return {
            totalComplexityReduction,
            totalLinesReduced,
            newMaintainability,
            complexityReductionPercentage,
        };
    }, [symbol, suggestions]);

    return (
        <Card className="bg-zinc-900/20 border-zinc-900/50">
            <CardHeader className="pb-2 px-8 pt-3">
                <CardTitle className="text-sm font-medium text-white -mt-2 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-zinc-400" />
                    Expected Impact
                </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-3 -mt-6">
                <div className="space-y-4">
                    <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-zinc-500">Complexity Reduction</span>
                            <span className="text-green-400">{impactData.totalComplexityReduction}</span>
                        </div>
                        <Progress
                            value={impactData.complexityReductionPercentage}
                            className="h-1 [&>div]:bg-green-500"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-zinc-500">Lines Reduced</span>
                            <span className="text-blue-400">{impactData.totalLinesReduced}</span>
                        </div>
                        <Progress value={30} className="h-1 [&>div]:bg-blue-500" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-zinc-500">Maintainability</span>
                            <span className="text-purple-400">{impactData.newMaintainability}</span>
                        </div>
                        <Progress
                            value={impactData.newMaintainability}
                            className="h-1 [&>div]:bg-purple-500"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
