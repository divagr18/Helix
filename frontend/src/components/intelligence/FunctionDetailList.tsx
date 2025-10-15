// src/components/intelligence/FunctionDetailList.tsx
import React, { useState } from 'react';
import { type CodeSymbol } from '@/types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';
import { Code, Sigma } from 'lucide-react';

interface FunctionDetailListProps {
    symbols: CodeSymbol[];
    onSymbolHover: (symbolId: number | null) => void;
    highlightedSymbolId: number | null;
}

export const FunctionDetailList: React.FC<FunctionDetailListProps> = ({ symbols, onSymbolHover, highlightedSymbolId }) => {
    const { activeRepository } = useWorkspaceStore();
    const [filter, setFilter] = useState('');

    const filteredSymbols = symbols.filter(s =>
        s.name.toLowerCase().includes(filter.toLowerCase()) ||
        (s.unique_id && s.unique_id.split(':')[0].toLowerCase().includes(filter.toLowerCase()))
    );

    const getComplexityColorClass = (complexity: number | null | undefined) => {
        if (!complexity) return 'text-muted-foreground';
        if (complexity >= 10) return 'text-red-400';
        if (complexity >= 5) return 'text-orange-400';
        return 'text-green-400';
    };

    return (
        <div className="flex flex-col h-full bg-card border border-border rounded-lg">
            {/* Header Section */}
            <div className="p-3 border-b border-border flex-shrink-0">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Function Details</h3>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded-md">
                        {symbols.length} functions
                    </span>
                </div>
                <Input
                    placeholder="Search functions or files..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="mt-3"
                />
            </div>

            {/* Legend Section */}
            <div className="flex justify-end items-center gap-4 px-3 py-1.5 border-b border-border text-xs text-muted-foreground font-medium flex-shrink-0">
                <div className="flex items-center gap-1.5" title="Cyclomatic Complexity">
                    <Sigma className="h-3 w-3 text-orange-500" />
                    <span>Complexity</span>
                </div>
                <div className="flex items-center gap-1.5" title="Lines of Code">
                    <Code className="h-3 w-3 text-blue-400" />
                    <span>LoC</span>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-grow min-h-0">
                <ScrollArea className="h-full">
                    <div className="p-2">
                        {filteredSymbols.map(symbol => {
                            const link = activeRepository && symbol.unique_id ? `/repository/${activeRepository.id}/code?file=${symbol.unique_id.split(':')[0]}&symbol=${symbol.id}` : '#';
                            const complexityColorClass = getComplexityColorClass(symbol.cyclomatic_complexity);

                            return (
                                <Link
                                    to={link}
                                    key={symbol.id}
                                    onMouseEnter={() => onSymbolHover(symbol.id)}
                                    onMouseLeave={() => onSymbolHover(null)}
                                    className={cn(
                                        "block p-3 rounded-md hover:bg-muted transition-colors",
                                        highlightedSymbolId === symbol.id && 'bg-muted'
                                    )}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="truncate flex-1 min-w-0">
                                            <p className="font-mono text-sm truncate">{symbol.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{symbol.unique_id?.split(':')[0]}</p>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs flex-shrink-0 ml-2">
                                            <span className={cn("flex items-center gap-1 font-semibold min-w-[3rem] justify-end", complexityColorClass)}>
                                                <Sigma className="h-3.5 w-3.5" />
                                                {symbol.cyclomatic_complexity}
                                            </span>
                                            <span className="flex items-center gap-1 text-blue-400 min-w-[3rem] justify-end">
                                                <Code className="h-3.5 w-3.5" />
                                                {symbol.loc}
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>
        </div>
    );
};