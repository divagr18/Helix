// src/components/intelligence/SymbolList.tsx
import React from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { SymbolListItem, type SymbolForListItem } from '@/components/repo-detail/SymbolListItem';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CodeFile } from '@/types';

// This component will need to receive all the action handlers and state from its parent
interface SymbolListProps {
    // We'll define these props later when we build the main panel
}

export const SymbolList: React.FC<SymbolListProps> = (props) => {
    const { selectedFile, setSelectedSymbol } = useRepo();

    if (!selectedFile) return null;

    // This is a placeholder for now. We will need to pass the real handlers.
    const placeholderProps = {
        generatedDocForThisSymbol: null,
        onGenerateDoc: (id: number) => console.log('Generate for', id),
        isGeneratingAnyDoc: false,
        isGeneratingThisDoc: false,
        onSaveDoc: (id: number, doc: string) => console.log('Save for', id, doc),
        isSavingAnyDoc: false,
        isSavingThisDoc: false,
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-border flex-shrink-0">
                <h3 className="font-semibold">Symbols in {selectedFile.file_path.split('/').pop()}</h3>
            </div>
            <ScrollArea className="flex-grow">
                <div className="p-2 space-y-2">
                    {/* We need a way to make the whole item clickable to select it */}
                    {selectedFile.symbols.map(func => (
                        <div key={`func-${func.id}`} onClick={() => setSelectedSymbol(func)}>
                            <SymbolListItem symbol={func as SymbolForListItem} {...placeholderProps} />
                        </div>
                    ))}
                    {selectedFile.classes.map(cls => (
                        <div key={`class-${cls.id}`}>
                            {/* We can render a simple header for the class */}
                            <h4 className="font-bold text-primary p-2">Class: {cls.name}</h4>
                            {cls.methods.map(method => (
                                <div key={`method-${method.id}`} onClick={() => setSelectedSymbol(method)}>
                                    <SymbolListItem symbol={{ ...method, className: cls.name } as SymbolForListItem} {...placeholderProps} />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};