import React from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from '@/components/ui/badge';
import { StatusIcon } from '@/components/StatusIcon';
import { OrphanIndicator } from '@/components/OrphanIndicator';
import { DocumentationLens } from '@/components/lenses/DocumentationLens';
import { MetricsLens } from '@/components/lenses/MetricLens';
import { CallGraphLens } from '@/components/lenses/CallGraphLens'; // Assuming this will be created
import type { CodeSymbol, GeneratedDoc } from '@/types';

// This interface combines the symbol data with all the props needed by its child "Lenses"
interface SymbolAccordionItemProps {
    symbol: CodeSymbol & { className?: string };
    generatedDoc: GeneratedDoc | null;
    onGenerateDoc: () => void; // No need for ID, it's scoped
    isGeneratingDoc: boolean;
    onSaveDoc: (docToSave: string) => void; // No need for ID, it's scoped
    isSavingDoc: boolean;
}
export const SymbolAccordionItem: React.FC<SymbolAccordionItemProps> = ({
    symbol,
    generatedDoc,
    onGenerateDoc,
    isGeneratingDoc,
    onSaveDoc,
    isSavingDoc,
}) => {
    return (
        <AccordionItem value={`symbol-${symbol.id}`} className="border-b border-border/80">

            {/* ================================================================== */}
            {/* The Accordion Trigger (The Always-Visible, Clickable Header)      */}
            {/* ================================================================== */}
            <AccordionTrigger className="p-3 rounded-t-lg text-left hover:bg-muted data-[state=open]:bg-muted data-[state=open]:rounded-b-none">
                <div className="w-full flex items-center justify-between gap-2">
                    {/* Left side: Name and Class Badge */}
                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                        <p className="text-base font-semibold text-foreground truncate" title={symbol.name}>
                            {symbol.name}
                        </p>
                        {symbol.className && (
                            <Badge variant="secondary" className="text-xs whitespace-nowrap flex-shrink-0">
                                {symbol.className}
                            </Badge>
                        )}
                    </div>

                    {/* Right side: Status Icons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusIcon documentationStatus={symbol.documentation_status} />
                        <OrphanIndicator isOrphan={symbol.is_orphan} />
                    </div>
                </div>
            </AccordionTrigger>

            {/* ================================================================== */}
            {/* The Accordion Content (The Collapsible Details)                   */}
            {/* ================================================================== */}
            <AccordionContent className="p-4 pt-3 bg-card/40 rounded-b-lg">
                {/* We now render our modular "Lenses" inside a structured layout */}
                <div className="space-y-6">

                    {/* --- Metrics Lens --- */}
                    <div>
                        <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Metrics</h4>
                        <MetricsLens symbol={symbol} />
                    </div>

                    {/* --- Documentation Lens --- */}
                    <div>
                        <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Documentation</h4>
                        <DocumentationLens
                            symbol={symbol}
                            generatedDoc={generatedDoc}
                            // Pass down handlers that are already scoped to this symbol's ID
                            onGenerateDoc={() => onGenerateDoc()}
                            isGenerating={isGeneratingDoc}
                            onSaveDoc={onSaveDoc}
                            isSaving={isSavingDoc}
                        />
                    </div>

                    {/* --- Call Graph Lens (Placeholder) --- */}
                    <div>
                        <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Call Graph</h4>
                        <CallGraphLens symbolId={symbol.id} />
                    </div>

                    {/* --- Future Lenses (e.g., Tests, Refactors) can be added here --- */}

                </div>
            </AccordionContent>
        </AccordionItem>
    );
};