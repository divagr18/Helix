// src/components/lenses/MetricsLens.tsx
import React from 'react';
import { type CodeSymbol } from '@/types';
import { Orbit, Sigma } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const MetricsLens: React.FC<{ symbol: CodeSymbol }> = ({ symbol }) => {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span>Lines: {symbol.start_line}-{symbol.end_line}</span>
            {typeof symbol.loc === 'number' && (
                <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger className="flex items-center cursor-default"><Orbit className="h-4 w-4 mr-1.5" /> {symbol.loc}</TooltipTrigger>
                        <TooltipContent><p>Lines of Code</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            {typeof symbol.cyclomatic_complexity === 'number' && (
                <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger className="flex items-center cursor-default"><Sigma className="h-4 w-4 mr-1.5" /> {symbol.cyclomatic_complexity}</TooltipTrigger>
                        <TooltipContent><p>Cyclomatic Complexity</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    );
};