// src/components/refactor/RefactoringSuggestionItem.tsx
import React, { useState } from 'react';
import { type RefactoringSuggestion } from '@/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Scissors, Split, Copy, Zap, RefreshCw } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface RefactoringSuggestionItemProps {
    suggestion: RefactoringSuggestion;
    isSelected: boolean;
    onSelect: () => void;
}

const getTypeIcon = (type: string) => {
    switch (type) {
        case "extract_method": return <Scissors className="w-4 h-4" />;
        case "simplify_conditional": return <Split className="w-4 h-4" />;
        case "remove_duplication": return <Copy className="w-4 h-4" />;
        default: return <Scissors className="w-4 h-4" />;
    }
};

const getSeverityBadge = (severity: string) => {
    switch (severity) {
        case "high": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">High</Badge>;
        case "medium": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Medium</Badge>;
        case "low": return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Low</Badge>;
        default: return null;
    }
};

export const RefactoringSuggestionItem: React.FC<RefactoringSuggestionItemProps> = ({ suggestion, isSelected, onSelect }) => {
    const [applyingRefactor, setApplyingRefactor] = useState(false);

    const handleApplyRefactor = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setApplyingRefactor(true);
        // Mock API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        setApplyingRefactor(false);
    };

    return (
        <div
            className={cn(
                "p-4 rounded-lg cursor-pointer transition-all duration-150 border",
                isSelected ? "bg-orange-500/10 border-orange-500/20" : "hover:bg-zinc-800/30 border-zinc-800/50"
            )}
            onClick={onSelect}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-start space-x-3">
                    <div className="text-orange-400 mt-0.5">{getTypeIcon(suggestion.type)}</div>
                    <div className="flex-1">
                        <div className="text-sm font-medium text-white mb-1">{suggestion.title}</div>
                        <div className="text-xs text-zinc-400 mb-2">{suggestion.description}</div>
                        <div className="flex items-center space-x-2">
                            {getSeverityBadge(suggestion.severity)}
                            <Badge variant="outline" className="border-zinc-700 text-zinc-400 bg-transparent text-xs">
                                -{suggestion.complexity_reduction} complexity
                            </Badge>
                        </div>
                    </div>
                </div>
                <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-black text-xs h-6 px-2"
                    onClick={handleApplyRefactor}
                    disabled={applyingRefactor}
                >
                    {applyingRefactor ? (
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                        <Zap className="w-3 h-3 mr-1" />
                    )}
                    Apply
                </Button>
            </div>

            {/* Code Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <div className="text-xs text-zinc-500 mb-1">Current Code</div>
                    <div className="bg-black/30 rounded border border-zinc-900/50 text-xs">
                        <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ background: 'transparent', padding: '0.75rem' }}>
                            {suggestion.current_code_snippet}
                        </SyntaxHighlighter>
                    </div>
                </div>
                <div>
                    <div className="text-xs text-zinc-500 mb-1">Refactored Code</div>
                    <div className="bg-black/30 rounded border border-green-500/20 text-xs">
                        <SyntaxHighlighter language="python" style={vscDarkPlus} customStyle={{ background: 'transparent', padding: '0.75rem' }}>
                            {suggestion.refactored_code_snippet}
                        </SyntaxHighlighter>
                    </div>
                </div>
            </div>
        </div>
    );
};