import React from 'react';
import { type CodeSymbol } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TestTube } from 'lucide-react';

interface TestAnalysisCardProps {
    symbol: CodeSymbol;
}

export const TestAnalysisCard: React.FC<TestAnalysisCardProps> = ({ symbol }) => {
    const testCoverage = 78;
    const suggestedTests = [
        "Test with invalid symbols or inputs",
        "Test database failure scenarios during data storage",
        "Test API timeout handling when calling yf.download",
    ];

    return (
        <Card className="bg-zinc-900/20 border-zinc-900/50">
            <CardHeader className="px-7 pt-2 pb-1 -mt-2">
                <CardTitle className="text-sm font-medium text-white flex items-center leading-none m-0">
                    <TestTube className="w-4 h-4 mr-2 text-zinc-400" />
                    Test Analysis
                </CardTitle>
            </CardHeader>
            <CardContent className="px-8 -mt-5 pb-3"> {/* Negative top margin here */}
                <div className="space-y-3">
                    <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-zinc-500">Current Coverage</span>
                            <span className="text-yellow-400">{testCoverage}%</span>
                        </div>
                        <Progress
                            value={testCoverage}
                            className="h-1 [&>div]:bg-yellow-400"
                        />
                    </div>
                    <div className="text-xs text-zinc-400">
                        <div className="mb-2 font-medium">Suggested Tests:</div>
                        <div className="space-y-1.5 -mb-4">
                            {suggestedTests.map((test, index) => (
                                <div key={index} className="flex items-start space-x-2">
                                    <div className="w-1 h-1 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                                    <span>{test}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

    );
};
