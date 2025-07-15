// src/components/intelligence/FunctionDetailList.tsx
import React, { useState } from 'react'; // Added useState for filter
import { type CodeSymbol } from '@/types';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { cn } from '@/lib/utils';
import { Code as GitCommit, Sigma } from 'lucide-react'; // Using GitCommit for LoC as a placeholder

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
        s.unique_id.split(':')[0].toLowerCase().includes(filter.toLowerCase())
    );

    const getComplexityColor = (complexity: number | null | undefined) => {
        if (!complexity) return 'text-muted-foreground';
        if (complexity >= 5) return 'text-complexity-high';
        if (complexity >= 3) return 'text-complexity-medium';
        return 'text-complexity-low';
    };

    return (
        <div className="flex flex-col h-full bg-card border border-border rounded-lg">
            <div className="p-3 border-b border-border flex-shrink-0">
                <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Function Details</h3>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                        <div className="flex items-center gap-1.5" title="Cyclomatic Complexity">
                            <Sigma className="h-3.5 w-3.5 text-orange-500" />
                            <span>Complexity</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Lines of Code">
                            <GitCommit className="h-3.5 w-3.5 text-blue-400" />
                            <span>LoC</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{symbols.length} functions</span>
                    </div>
                </div>

                <Input
                    placeholder="Search functions or files..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="mt-3"
                />
            </div>

            {/* --- NEW: Legend Header --- */}

            {/* --- END NEW --- */}

            <ScrollArea className="flex-grow">
                <div className="p-2">
                    {filteredSymbols.map(symbol => {
                        const link = activeRepository ? `/repository/${activeRepository.id}/code?file=${symbol.unique_id.split(':')[0]}&symbol=${symbol.id}` : '#';
                        const complexityColor = getComplexityColor(symbol.cyclomatic_complexity);

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
                                    <div className="truncate">
                                        <p className="font-mono text-sm truncate">{symbol.name}</p>
                                        <p className="text-xs text-muted-foreground truncate">{symbol.unique_id.split(':')[0]}</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs flex-shrink-0">
                                        <span
                                            className="flex items-center gap-1 font-semibold"
                                            style={{
                                                color:
                                                    symbol.cyclomatic_complexity == null
                                                        ? undefined
                                                        : symbol.cyclomatic_complexity >= 5
                                                            ? 'var(--complexity-high)'
                                                            : symbol.cyclomatic_complexity >= 3
                                                                ? 'var(--complexity-medium)'
                                                                : 'var(--complexity-low)',
                                            }}
                                        >

                                            <Sigma className="h-3 w-3" /> {symbol.cyclomatic_complexity}
                                        </span>
                                        <span className="flex items-center gap-1" style={{ color: '#A1A1AA' }}>
                                            <GitCommit className="h-3 w-3" /> {symbol.loc}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
};