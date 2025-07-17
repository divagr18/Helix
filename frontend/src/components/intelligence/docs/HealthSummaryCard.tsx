// src/components/intelligence/docs/HealthSummaryCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, GitPullRequest, FileText, AlertTriangle, Clock, ArrowRight } from 'lucide-react';

interface HealthSummaryCardProps {
    overallCoverage: number;
    documentedSymbols: number;
    totalSymbols: number;
    missingDocstrings: number;
    staleDocstrings: number;
}

export const HealthSummaryCard: React.FC<HealthSummaryCardProps> = ({
    overallCoverage,
    documentedSymbols,
    totalSymbols,
    missingDocstrings,
    staleDocstrings,
}) => {
    return (
        <Card className="bg-zinc-900/50 border-zinc-800/60">
            {/* --- FIX: Reduced padding bottom on header --- */}
            <CardHeader className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-zinc-200 flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2.5 text-zinc-500" />
                        Overall Documentation Health
                    </CardTitle>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-3">
                        <GitPullRequest className="w-3.5 h-3.5 mr-1.5" />
                        Create PR
                    </Button>
                </div>
            </CardHeader>
            {/* --- FIX: Reduced padding on content --- */}
            <CardContent className="px-5 pb-5">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* Main Metric */}
                    <div className="lg:col-span-2 flex items-center justify-center p-4 bg-zinc-900/60 rounded-lg border border-zinc-800/70">
                        <div className="text-center">
                            <p className="text-sm text-zinc-400 font-light">Overall Coverage</p>
                            <p className="text-5xl font-bold text-blue-400 my-1">
                                {overallCoverage.toFixed(1)}%
                            </p>
                            <p className="text-xs text-zinc-500">
                                ({documentedSymbols} / {totalSymbols} symbols)
                            </p>
                        </div>
                    </div>

                    {/* Sub-Metrics Grid */}
                    <div className="lg:col-span-3 grid grid-cols-3 gap-4">
                        {/* --- FIX: Thinner Stat Card Item --- */}
                        <div className="p-4 bg-zinc-900/60 rounded-lg border border-zinc-800/70 flex flex-col items-center justify-center">
                            <div className="flex items-center text-zinc-400">
                                <FileText className="w-3.5 h-3.5 mr-2" />
                                <span className="text-xs font-light">Documented</span>
                            </div>
                            <p className="text-xl font-semibold mt-1.5">{documentedSymbols}</p>
                        </div>
                        <div className="p-4 bg-zinc-900/60 rounded-lg border border-zinc-800/70 flex flex-col items-center justify-center">
                            <div className="flex items-center text-red-400">
                                <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                                <span className="text-xs font-light">Missing</span>
                            </div>
                            <p className="text-xl font-semibold mt-1.5">{missingDocstrings}</p>
                        </div>
                        <div className="p-4 bg-zinc-900/60 rounded-lg border border-zinc-800/70 flex flex-col items-center justify-center">
                            <div className="flex items-center text-yellow-400">
                                <Clock className="w-3.5 h-3.5 mr-2" />
                                <span className="text-xs font-light">Stale</span>
                            </div>
                            <p className="text-xl font-semibold mt-1.5">{staleDocstrings}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};