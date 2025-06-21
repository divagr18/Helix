// src/components/symbol-detail/CallGraphSection.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area'; // If lists can be long
import { DependencyListItem } from './DependancyListItem';
import { type LinkedSymbol } from '@/pages/SymbolDetailPage'; // Assuming type

interface CallGraphSectionProps {
    outgoingCalls: LinkedSymbol[];
    incomingCalls: LinkedSymbol[];
}

const RenderDependencyList: React.FC<{ dependencies: LinkedSymbol[]; title: string }> = ({ dependencies, title }) => (
    <Card className="flex-1 min-w-[280px]"> {/* min-w to prevent too much squishing on small screens */}
        <CardHeader className="pb-2 pt-3 px-3 md:pb-3 md:pt-4 md:px-4"> {/* Adjusted padding */}
            <CardTitle className="text-base md:text-lg font-semibold">
                {title} ({dependencies.length})
            </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
            {dependencies.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">None</p>
            ) : (
                // Max height for the list, scroll if it overflows
                <ScrollArea className="max-h-60 md:max-h-72 pr-1">
                    <ul className="list-none p-0 m-0 space-y-1">
                        {dependencies.map(dep => (
                            <DependencyListItem key={`${title}-${dep.id}`} dependency={dep} />
                        ))}
                    </ul>
                </ScrollArea>
            )}
        </CardContent>
    </Card>
);

export const CallGraphSection: React.FC<CallGraphSectionProps> = ({ outgoingCalls, incomingCalls }) => {
    return (
        <div className="mb-6 md:mb-8">
            <h2 className="text-xl md:text-2xl font-semibold mb-3 md:mb-4 pb-2 border-b border-border">
                Call Graph
            </h2>
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                <RenderDependencyList dependencies={outgoingCalls} title="Calls (Dependencies)" />
                <RenderDependencyList dependencies={incomingCalls} title="Called By (Dependents)" />
            </div>
        </div>
    );
};