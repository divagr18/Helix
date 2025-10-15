// src/components/content/SymbolInspector.tsx
import React from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { type CodeSymbol } from '@/types';

// A simple component to render a single selectable symbol
const SymbolRow: React.FC<{ symbol: CodeSymbol, isSelected: boolean, onSelect: () => void, className?: string }> =
    ({ symbol, isSelected, onSelect, className }) => (
        <div
            onClick={onSelect}
            className={cn(
                "p-2 rounded-md cursor-pointer hover:bg-muted",
                isSelected && "bg-accent text-accent-foreground"
            )}
        >
            <p className="font-mono text-sm truncate">
                {className && <span className="text-muted-foreground">{className}::</span>}
                {symbol.name}
            </p>
        </div>
    );

export const SymbolInspector = () => {
    const { selectedFile, selectedSymbol, setSelectedSymbol } = useRepo();

    if (!selectedFile) return null;

    const handleSelectSymbol = (symbol: CodeSymbol) => {
        // If the same symbol is clicked again, deselect it. Otherwise, select the new one.
        setSelectedSymbol(prev => prev?.id === symbol.id ? null : symbol);
    };

    return (
        <div className="p-4 space-y-4">
            <h3 className="text-lg font-semibold">Symbols in File</h3>

            {/* Top-level functions */}
            {selectedFile.symbols.length > 0 && (
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Functions</h4>
                    <div className="space-y-1">
                        {selectedFile.symbols.map(func => (
                            <SymbolRow
                                key={`func-${func.id}`}
                                symbol={func}
                                isSelected={selectedSymbol?.id === func.id}
                                onSelect={() => handleSelectSymbol(func)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Classes and their methods */}
            {selectedFile.classes.map(cls => (
                <Card key={`class-${cls.id}`} className="bg-card/50">
                    <CardHeader className="p-3">
                        <CardTitle className="text-md text-primary">Class: {cls.name}</CardTitle>
                    </CardHeader>
                    <div className="p-2 pt-0 space-y-1">
                        {cls.methods.map(method => (
                            <SymbolRow
                                key={`method-${method.id}`}
                                symbol={method}
                                className={cls.name}
                                isSelected={selectedSymbol?.id === method.id}
                                onSelect={() => handleSelectSymbol(method)}
                            />
                        ))}
                    </div>
                </Card>
            ))}

            {(selectedFile.symbols.length === 0 && selectedFile.classes.length === 0) && (
                <p className="text-muted-foreground text-center py-6">No functions or classes found.</p>
            )}
        </div>
    );
};