// src/components/repo-detail/SymbolListItem.tsx
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Save, Loader2, ChevronDown, ChevronUp, Eye, EyeOff, Sigma, Orbit } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

import { StatusIcon } from '../StatusIcon'; // Ensure this component is robust
import { OrphanIndicator } from '../OrphanIndicator';
import type { CodeSymbol } from '@/types'; // Assuming CodeSymbol is now in src/types.ts

// This is the symbol type with potential additions from AnalysisPanel (like className)
export interface SymbolForListItem extends CodeSymbol {
  className?: string; 
}

interface SymbolListItemProps {
  symbol: SymbolForListItem;
  generatedDocForThisSymbol: string | null; // Specifically the AI doc for THIS symbol
  onGenerateDoc: (symbolId: number) => void;
  isGeneratingAnyDoc: boolean; // True if ANY AI doc generation is globally in progress
  isGeneratingThisDoc: boolean; // True if AI is currently generating for THIS specific symbol
  onSaveDoc: (symbolId: number, docToSave: string) => void; // Pass the doc to save
  isSavingAnyDoc: boolean; // True if ANY doc save is globally in progress
  isSavingThisDoc: boolean; // True if THIS specific doc is currently being saved
}

export const SymbolListItem: React.FC<SymbolListItemProps> = ({
  symbol,
  generatedDocForThisSymbol,
  onGenerateDoc,
  isGeneratingAnyDoc,
  isGeneratingThisDoc,
  onSaveDoc,
  isSavingAnyDoc,
  isSavingThisDoc,
}) => {
  // Show existing doc by default if no AI suggestion is present, otherwise keep it closed.
  const [isExistingDocOpen, setIsExistingDocOpen] = useState(false);
  // Always show AI suggestion by default if it exists.
  const [isAiSuggestionOpen, setIsAiSuggestionOpen] = useState(true);


  const hasPersistedDocumentation = symbol.documentation && symbol.documentation.trim().length > 0;
  const hasAiSuggestion = generatedDocForThisSymbol && generatedDocForThisSymbol.trim().length > 0;

  // Determine which doc to show as "primary" if AI suggestion exists
  const displayDoc = hasAiSuggestion ? generatedDocForThisSymbol : symbol.documentation;
  const displayDocSource = hasAiSuggestion ? "AI Suggestion" : "Existing Documentation";

  const handleGenerateClick = () => {
    setIsExistingDocOpen(false); // Close existing doc when generating new AI one
    setIsAiSuggestionOpen(true); // Ensure AI section opens
    onGenerateDoc(symbol.id);
  };
  
  const handleSaveClick = () => {
    if (generatedDocForThisSymbol) {
        onSaveDoc(symbol.id, generatedDocForThisSymbol);
    } else {
        console.warn("Attempted to save but no AI generated document is available for symbol:", symbol.id);
        // Optionally, show an alert to the user
    }
  };

  // Memoize formatted doc to prevent re-calculation on every render unless doc changes
  const formattedAiDoc = useMemo(() => {
    if (!hasAiSuggestion) return null;
    return generatedDocForThisSymbol.split('\n').map((line, index, arr) => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('Args:') || trimmedLine.startsWith('Returns:') || trimmedLine.startsWith('Raises:')) {
            return <strong key={index} className="block mt-2 text-sky-400">{line}</strong>;
        }
        if (trimmedLine.startsWith('- ') || trimmedLine.match(/^\s*\w+\s*\(.+\):/)) {
            return <div key={index} className="ml-4 text-purple-400">{line}</div>;
        }
        if (index === 0 && !arr[index + 1]?.trim().startsWith('Args:')) {
            return <p key={index} className="mb-2 font-semibold">{line}</p>;
        }
        return <span key={index}>{line}{index < arr.length - 1 && <br />}</span>;
    });
  }, [generatedDocForThisSymbol, hasAiSuggestion]);


  return (
    <Card className="mb-3 bg-card border-border shadow-sm data-[state=open]:border-primary/50 transition-all"> {/* Highlight card if a collapsible is open */}
      <CardHeader className="p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden min-w-0"> {/* min-w-0 for truncate */}
            <CardTitle className="text-base md:text-lg font-semibold text-foreground truncate">
              <Link to={`/symbol/${symbol.id}`} className="hover:text-primary hover:underline transition-colors" title={symbol.name}>
                {symbol.name}
              </Link>
            </CardTitle>
            {symbol.className && (
              <Badge variant="outline" className="text-xs whitespace-nowrap border-dashed">
                {symbol.className}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusIcon documentationStatus={symbol.documentation_status} />
            <OrphanIndicator isOrphan={symbol.is_orphan} />
          </div>
        </div>
        <CardDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
          <span>Lines: {symbol.start_line}-{symbol.end_line}</span>
          {typeof symbol.loc === 'number' && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center cursor-default">
                    <Orbit className="h-3.5 w-3.5 mr-1 opacity-70" /> {symbol.loc}
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Lines of Code</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {typeof symbol.cyclomatic_complexity === 'number' && (
             <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center cursor-default">
                    <Sigma className="h-3.5 w-3.5 mr-1 opacity-70" /> {symbol.cyclomatic_complexity}
                  </span>
                </TooltipTrigger>
                <TooltipContent><p>Cyclomatic Complexity</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardDescription>
      </CardHeader>

      {/* Section for Persisted Documentation (if it exists AND no AI suggestion is overriding) */}
      {hasPersistedDocumentation && (
        <Collapsible open={isExistingDocOpen} onOpenChange={setIsExistingDocOpen} className="px-3 md:px-4 pb-1 md:pb-2">
            <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground hover:text-foreground -ml-2 h-auto py-1">
                {isExistingDocOpen ? <EyeOff className="h-3.5 w-3.5 mr-2" /> : <Eye className="h-3.5 w-3.5 mr-2" />}
                {isExistingDocOpen ? 'Hide Existing Documentation' : `Show Existing Documentation`}
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
                <div className="text-sm whitespace-pre-wrap bg-background/70 p-3 rounded-md border border-border font-mono text-muted-foreground max-h-48 overflow-y-auto">
                {symbol.documentation}
                </div>
            </CollapsibleContent>
        </Collapsible>
      )}
      
      {/* AI Generated Docstring Display & Save Area */}
      {hasAiSuggestion && (
        <Collapsible open={isAiSuggestionOpen} onOpenChange={setIsAiSuggestionOpen} 
                     className="border-t border-border data-[state=open]:border-t-primary/30 data-[state=open]:bg-primary/5 transition-colors">
            <CardHeader className="p-3 md:p-4 !pb-2"> {/* Remove CardHeader's default bottom padding */}
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between -ml-2 text-foreground h-auto py-1 hover:bg-primary/10">
                        <span>AI Generated Suggestion</span>
                        {isAiSuggestionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent className="px-3 md:px-4 pb-3 md:pb-4 pt-1">
                <div className="text-sm whitespace-pre-wrap bg-background/70 p-3 rounded-md border border-border font-mono text-foreground max-h-60 overflow-y-auto">
                    {formattedAiDoc}
                </div>
                <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveClick}
                    disabled={isSavingThisDoc || isSavingAnyDoc || isGeneratingAnyDoc} // Disable if this is saving, or any other save/gen is happening
                    className="w-full mt-3"
                >
                    {isSavingThisDoc ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                    <Save className="mr-2 h-4 w-4" />
                    )}
                    {isSavingThisDoc ? 'Saving...' : 'Save AI Suggestion'}
                </Button>
            </CollapsibleContent>
        </Collapsible>
      )}

      {/* AI Actions Footer (Generate/Regenerate Button) */}
      <CardFooter className="p-3 md:p-4 border-t border-border">
        <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateClick}
            // Disable if this one is generating, or if ANY save is in progress, or if ANY other generation is in progress (but not this one)
            disabled={isGeneratingThisDoc || isSavingAnyDoc || (isGeneratingAnyDoc && !isGeneratingThisDoc) }
            className="w-full"
        >
            {isGeneratingThisDoc ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Bot className="mr-2 h-4 w-4" />
            )}
            {isGeneratingThisDoc ? 'Generating...' : (hasPersistedDocumentation || hasAiSuggestion ? 'Regenerate with AI' : 'Generate with AI')}
        </Button>
      </CardFooter>
    </Card>
  );
};