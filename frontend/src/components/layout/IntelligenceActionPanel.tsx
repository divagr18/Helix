// src/components/layout/IntelligenceActionPanel.tsx
import React from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { Accordion } from "@/components/ui/accordion";
import { ScrollArea } from '@/components/ui/scroll-area';
import { SymbolAccordionItem } from '@/components/intelligence/SymbolAccordionItem';

export const IntelligenceActionPanel = () => {
    // Consume all necessary state and handlers from our powerful context
    const {
        selectedFile,
        selectedSymbol,
        setSelectedSymbol,
        generatedDocs,
        generatingDocId,
        savingDocId,
        handleGenerateDoc,
        handleSaveDoc,
    } = useRepo();

    if (!selectedFile) {
        return (
            <aside className="w-[450px] flex-shrink-0 border-l border-border bg-background/80 flex items-center justify-center p-4">
                <p className="text-sm text-muted-foreground text-center">Select a file from the explorer to see its symbols.</p>
            </aside>
        );
    }

    // Flatten the symbols from the file into one list, sorted by line number
    const allSymbols = [
        ...selectedFile.symbols,
        ...selectedFile.classes.flatMap(cls => cls.methods.map(m => ({ ...m, className: cls.name })))
    ].sort((a, b) => a.start_line - b.start_line);

    return (
        <aside className="w-[450px] flex-shrink-0 border-l border-border flex flex-col bg-background/80">
            <div className="p-4 border-b border-border flex-shrink-0">
                <h3 className="font-semibold truncate">Intelligence for {selectedFile.file_path.split('/').pop()}</h3>
            </div>
            <ScrollArea className="flex-grow">
                <Accordion
                    type="single"
                    collapsible
                    className="p-2"
                    // The value of the open item is controlled by the selectedSymbol in our context
                    value={selectedSymbol ? `symbol-${selectedSymbol.id}` : ''}
                    // When the user clicks an item, we update the context
                    onValueChange={(value) => {
                        const symbolIdStr = value.replace('symbol-', '');
                        const symbolId = parseInt(symbolIdStr, 10);
                        const symbol = allSymbols.find(s => s.id === symbolId);
                        setSelectedSymbol(symbol || null);
                    }}
                >
                    {allSymbols.map(symbol => (
                        <SymbolAccordionItem
                            key={symbol.id}
                            symbol={symbol}
                            // Pass down the relevant state and handlers for this specific symbol
                            generatedDoc={generatedDocs[symbol.id] || null}
                            isGeneratingDoc={generatingDocId === symbol.id}
                            onGenerateDoc={() => handleGenerateDoc(symbol.id)}
                            onSaveDoc={(docToSave: string) => handleSaveDoc(symbol.id, docToSave)}
                            isSavingDoc={savingDocId === symbol.id}
                            generatingDocId={generatingDocId}
                            savingDocId={savingDocId}
                        />
                    ))}
                </Accordion>
            </ScrollArea>
        </aside>
    );
};