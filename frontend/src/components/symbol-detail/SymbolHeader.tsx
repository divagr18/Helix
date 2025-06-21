// src/components/symbol-detail/SymbolHeader.tsx
import React from 'react';
import { ArrowLeft, Sigma, Orbit } from 'lucide-react'; // Replaced FaRulerCombined, FaBrain

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StatusIcon } from '../StatusIcon'; // Adjust path
import { OrphanIndicator } from '../OrphanIndicator'; // Adjust path
import { type SymbolDetail } from '@/pages/SymbolDetailPage'; // Assuming type is in parent or src/types.ts

interface SymbolHeaderProps {
    symbol: SymbolDetail; // Pass the whole symbol object for now
    onNavigateBack: () => void;
}

export const SymbolHeader: React.FC<SymbolHeaderProps> = ({ symbol, onNavigateBack }) => {
    return (
        <div className="mb-6 md:mb-8">
            <Button variant="outline" size="sm" onClick={onNavigateBack} className="mb-4 md:mb-6">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
            </Button>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 border-b border-border pb-3 md:pb-4 mb-3 md:mb-4">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    <h1 className="text-xl md:text-2xl lg:text-3xl font-semibold text-primary truncate" title={symbol.name}>
                        {symbol.name}
                    </h1>
                    <StatusIcon
                        documentationStatus={symbol.documentation_status}
                    // hasDoc, contentHash, docHash can be derived in StatusIcon if needed
                    />
                    <OrphanIndicator isOrphan={symbol.is_orphan} />
                </div>
                <Badge variant="secondary" className="text-xs md:text-sm whitespace-nowrap self-start md:self-center">
                    Lines: {symbol.start_line} - {symbol.end_line}
                </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs md:text-sm text-muted-foreground">
                <span className="font-mono truncate" title={symbol.unique_id}>{symbol.unique_id}</span>
                {typeof symbol.loc === 'number' && (
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center cursor-default">
                                    <Orbit className="h-3.5 w-3.5 mr-1 opacity-80" /> {symbol.loc}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent><p>Lines of Code (LOC)</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {typeof symbol.cyclomatic_complexity === 'number' && (
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="flex items-center cursor-default">
                                    <Sigma className="h-3.5 w-3.5 mr-1 opacity-80" /> {symbol.cyclomatic_complexity}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent><p>Cyclomatic Complexity (CC)</p></TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        </div>
    );
};