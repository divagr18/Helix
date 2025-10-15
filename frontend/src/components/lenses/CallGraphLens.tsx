// src/components/lenses/CallGraphLens.tsx
import React from 'react';

interface CallGraphLensProps {
    symbolId: number;
}

export const CallGraphLens: React.FC<CallGraphLensProps> = ({ symbolId }) => {
    // The actual graph implementation will go here later.
    // For now, it's just a placeholder.
    return (
        <div className="p-4 text-center border border-dashed rounded-lg bg-card/50">
            <p className="text-sm text-muted-foreground italic">
                Call Graph visualization for symbol {symbolId} will appear here.
            </p>
        </div>
    );
};