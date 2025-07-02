import React from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { SymbolListItem, type SymbolForListItem } from './SymbolListItem';
import { ClassSummarySection } from './ClassSummarySection';
import type { CodeFile, CodeSymbol, GeneratedDoc } from '@/types';

interface AnalysisPanelProps {
  selectedFile: CodeFile | null;
  generatedDocs: Record<number, GeneratedDoc>;
  onGenerateDoc: (symbolId: number) => void;
  generatingDocId: number | null;
  onSaveDoc: (symbolId: number, doc: string) => void;
  savingDocId: number | null;
  onAnalysisChange: () => void; // Callback to refetch data after a summary is generated/saved
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  selectedFile,
  generatedDocs,
  onGenerateDoc,
  generatingDocId,
  onSaveDoc,
  savingDocId,
  onAnalysisChange,
}) => {
  // Derived state to simplify passing props down
  const isAnyDocGenerating = generatingDocId !== null;
  const isAnyDocSaving = savingDocId !== null;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Panel Header */}
      <div className="p-3 md:p-4 border-b border-border sticky top-0 bg-card z-10">
        <h3 className="text-base md:text-lg font-semibold text-foreground">
          Analysis for: 
          {selectedFile ? (
            <span className="font-normal text-muted-foreground ml-1 truncate" title={selectedFile.file_path}>
              {selectedFile.file_path.split('/').pop()}
            </span>
          ) : (
            <span className="font-normal text-muted-foreground ml-1">No file selected</span>
          )}
        </h3>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow overflow-y-auto p-2 md:p-3 space-y-1">
        {selectedFile ? (
          (selectedFile.symbols.length > 0 || selectedFile.classes.length > 0) ? (
            <>
              {/* Render top-level functions */}
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

              {/* Render classes and their methods */}
              {selectedFile.classes.map(cls => (
                <Card key={`class-${cls.id}`} className="mb-3 bg-card/50 border-border shadow-sm">
                  
                  {/* CardHeader now only contains the title */}
                  <CardHeader className="p-3 md:p-4 !pb-2">
                    <CardTitle className="text-md md:text-lg font-semibold text-primary">
                      Class: {cls.name}
                    </CardTitle>
                  </CardHeader>
                  
                  {/* A new div below the header holds the summary section */}
                  <div className="px-3 md:px-4 pb-3">
                    <ClassSummarySection 
                      codeClass={cls} 
                      onSummaryGenerated={onAnalysisChange} 
                    />
                  </div>

                  {/* Optional: A visual separator */}
                  <div className="border-t border-border/50 mx-4"></div>

                  {/* The list of methods for the class */}
                  <div className="space-y-1 p-2">
                    {cls.methods.map(method => (
                      <SymbolListItem
                        key={`method-${method.id}`}
                        symbol={{ ...method, className: cls.name } as SymbolForListItem}
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
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center py-10">No functions or classes found in this file.</p>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-center py-10">Select a file to see its analysis.</p>
          </div>
        )}
      </div>
    </div>
  );
};