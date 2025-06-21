// src/components/repo-detail/AnalysisPanel.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { SymbolListItem, type SymbolForListItem } from './SymbolListItem'; // Import updated types/component
import type { CodeFile, CodeClass } from '@/types'; // Assuming central types
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';


interface AnalysisPanelProps {
  selectedFile: CodeFile | null;
  generatedDocs: Record<number, string>; // Maps symbol.id to its AI generated doc string
  onGenerateDoc: (symbolId: number) => void;
  generatingDocId: number | null; // ID of the symbol whose doc is currently being generated (global for panel)
  onSaveDoc: (symbolId: number, docToSave: string) => void; // Expects doc string to save
  savingDocId: number | null; // ID of the symbol whose doc is currently being saved (global for panel)
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  selectedFile,
  generatedDocs,
  onGenerateDoc,
  generatingDocId,
  onSaveDoc,
  savingDocId,
}) => {

  const isAnyDocGenerating = generatingDocId !== null;
  const isAnyDocSaving = savingDocId !== null;

  return (
    <div className="h-full flex flex-col bg-background"> {/* Use bg-background for the panel itself to contrast with Cards */}
      <div className="p-3 md:p-4 border-b border-border sticky top-0 bg-card z-10">
        <h3 className="text-base md:text-lg font-semibold text-foreground">
          Analysis for: {selectedFile ? 
            <span className="font-normal text-muted-foreground ml-1 truncate" title={selectedFile.file_path}>
              {selectedFile.file_path.split('/').pop()}
            </span> 
            : <span className="font-normal text-muted-foreground ml-1">No file selected</span>
          }
        </h3>
      </div>

      <div className="flex-grow overflow-y-auto p-2 md:p-3 space-y-1"> {/* Reduced space-y to allow cards to manage their margin */}
        {selectedFile ? (
          (selectedFile.symbols.length > 0 || selectedFile.classes.length > 0) ? (
            <>
              {selectedFile.symbols.map(func => (
                <SymbolListItem
                  key={`func-${func.id}`}
                  symbol={func as SymbolForListItem}
                  generatedDocForThisSymbol={generatedDocs[func.id] || null}
                  onGenerateDoc={onGenerateDoc}
                  isGeneratingAnyDoc={isAnyDocGenerating}
                  isGeneratingThisDoc={generatingDocId === func.id}
                  onSaveDoc={onSaveDoc}
                  isSavingAnyDoc={isAnyDocSaving}
                  isSavingThisDoc={savingDocId === func.id}
                />
              ))}

              {selectedFile.classes.map(cls => (
                <Card key={`class-${cls.id}`} className="mb-3 bg-card border-border shadow-sm">
                  <CardHeader className="p-3 md:p-4 !pb-2"> {/* Less bottom padding for class header */}
                    <CardTitle className="text-md md:text-lg font-semibold text-primary">Class: {cls.name}</CardTitle>
                  </CardHeader>
                  {/* No CardContent needed if SymbolListItems are direct children visually */}
                  <div className="space-y-1 px-1 pb-1 md:px-2 md:pb-2"> {/* Add padding around methods */}
                    {cls.methods.map(method => (
                      <SymbolListItem
                        key={`method-${method.id}`}
                        symbol={{...method, className: cls.name } as SymbolForListItem}
                        generatedDocForThisSymbol={generatedDocs[method.id] || null}
                        onGenerateDoc={onGenerateDoc}
                        isGeneratingAnyDoc={isAnyDocGenerating}
                        isGeneratingThisDoc={generatingDocId === method.id}
                        onSaveDoc={onSaveDoc}
                        isSavingAnyDoc={isAnyDocSaving}
                        isSavingThisDoc={savingDocId === method.id}
                      />
                    ))}
                  </div>
                </Card>
              ))}
            </>
          ) : (
            <p className="text-muted-foreground text-center py-10">No functions or classes found in this file.</p>
          )
        ) : (
          <p className="text-muted-foreground text-center py-10">Select a file to see its analysis.</p>
        )}
      </div>
    </div>
  );
};