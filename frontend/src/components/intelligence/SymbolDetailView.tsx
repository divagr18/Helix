// src/components/intelligence/SymbolDetailView.tsx
import React from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export const SymbolDetailView = () => {
    const { selectedSymbol, setSelectedSymbol } = useRepo();

    if (!selectedSymbol) return null;

    return (
        <div className="h-full flex flex-col">
            <div className="p-3 border-b border-border flex items-center gap-2 flex-shrink-0">
                <Button variant="ghost" size="icon" onClick={() => setSelectedSymbol(null)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold truncate">{selectedSymbol.name}</h3>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-6">
                <div className="p-4 rounded-lg bg-card border">
                    <h4 className="font-bold mb-2">Documentation Lens</h4>
                    <p className="text-sm text-muted-foreground">The UI for generating and saving docs will go here.</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                    <h4 className="font-bold mb-2">Intelligence Lens</h4>
                    <p className="text-sm text-muted-foreground">Metrics and call graph will go here.</p>
                </div>
                {/* Other lenses will go here */}
            </div>
        </div>
    );
};