// src/components/refactor/SymbolHeader.tsx
import React from 'react';
import { type CodeSymbol } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code2, Eye } from 'lucide-react';

interface SymbolHeaderProps {
    symbol: CodeSymbol;
    // We'll manage the show/hide state in the parent page later
    // onToggleShowFullCode: () => void;
    // isFullCodeVisible: boolean;
}

// A helper to format the file path for display
const formatFilePath = (uniqueId: string): string => {
    return uniqueId.split(':')[0];
};

// A helper to extract the class name, if it exists
const getClassName = (uniqueId: string): string | null => {
    const parts = uniqueId.split(':');
    if (parts.length === 3) { // e.g., path.py:ClassName:methodName
        return parts[1];
    }
    return null;
};

export const SymbolHeader: React.FC<SymbolHeaderProps> = ({ symbol }) => {
    const filePath = formatFilePath(symbol.unique_id);
    const className = getClassName(symbol.unique_id);

    // Mock data for last modified, as it's not in our current model
    const lastModified = "2 days ago";
    const author = "john.doe";

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                {/* Left side: Symbol details */}
                <div>
                    <div className="flex items-center space-x-3 mb-2">
                        <Code2 className="w-6 h-6 text-zinc-400 flex-shrink-0" />
                        <h1 className="text-2xl font-semibold text-white font-mono">{symbol.name}</h1>
                        {className && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs">
                                {className}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-zinc-500 pl-9">
                        <span className="font-mono">{filePath}</span>
                        <span>
                            Lines {symbol.start_line}-{symbol.end_line}
                        </span>
                        {/* We can add this back once the data is available in the model */}
                        {/* <span>
              Modified {lastModified} by {author}
            </span> */}
                    </div>
                </div>

                {/* Right side: Action buttons */}
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        // onClick={onToggleShowFullCode}
                        className="border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 bg-transparent text-xs h-7"
                    >
                        <Eye className="w-3 h-3 mr-1.5" />
                        {/* {isFullCodeVisible ? "Hide" : "Show"} Full Code */}
                        Show Full Code
                    </Button>
                </div>
            </div>
        </div>
    );
};