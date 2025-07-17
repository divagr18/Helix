// src/components/intelligence/docs/CoverageHotspotsCard.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Target, TrendingDown, TrendingUp, FileText, CheckCircle, Sparkles, Eye } from 'lucide-react';

interface FileStat {
    name: string;
    path: string;
    coverage: number;
}

interface CoverageHotspotsCardProps {
    worstFiles: FileStat[];
    bestFiles: FileStat[];
}

export const CoverageHotspotsCard: React.FC<CoverageHotspotsCardProps> = ({ worstFiles, bestFiles }) => {
    return (
        <Card className="bg-zinc-900/50 border-zinc-800/60">
            {/* --- FIX: Reduced padding bottom on header --- */}
            <CardHeader className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-zinc-200 flex items-center">
                        <Target className="w-4 h-4 mr-2.5 text-zinc-500" />
                        Coverage Hotspots
                    </CardTitle>
                    <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 bg-transparent text-xs h-7 px-3">
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        View All Files
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
                {/* Needs Improvement */}
                <div>
                    <div className="flex items-center mb-3">
                        <TrendingDown className="w-4 h-4 text-red-400 mr-2" />
                        <h3 className="text-sm font-medium">Needs Immediate Attention</h3>
                    </div>
                    <div className="space-y-2">
                        {worstFiles.map((file) => (
                            <div key={file.name} className="flex items-center justify-between p-2.5 bg-zinc-900/60 rounded-md hover:bg-zinc-800/80 cursor-pointer group">
                                <div className="flex items-center space-x-3">
                                    <FileText className="w-4 h-4 text-zinc-500" />
                                    <div>
                                        <div className="text-sm font-medium">{file.name}</div>
                                        <div className="text-xs text-zinc-500 font-mono">{file.path}</div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <div className="text-sm font-semibold text-red-400">{file.coverage.toFixed(1)}%</div>
                                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Sparkles className="w-3 h-3 mr-1" />
                                        Fix
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator className="bg-zinc-800/50" />

                {/* Well-Documented */}
                <div>
                    <div className="flex items-center mb-3">
                        <TrendingUp className="w-4 h-4 text-green-400 mr-2" />
                        <h3 className="text-sm font-medium">Well-Documented Examples</h3>
                    </div>
                    <div className="space-y-2">
                        {bestFiles.map((file) => (
                            <div key={file.name} className="flex items-center justify-between p-2.5 bg-zinc-900/60 rounded-md hover:bg-zinc-800/80 cursor-pointer">
                                <div className="flex items-center space-x-3">
                                    <CheckCircle className="w-4 h-4 text-green-400" />
                                    <div>
                                        <div className="text-sm font-medium">{file.name}</div>
                                        <div className="text-xs text-zinc-500 font-mono">{file.path}</div>
                                    </div>
                                </div>
                                <div className="text-sm font-semibold text-green-400">{file.coverage.toFixed(1)}%</div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};