// src/components/lenses/DocumentationLens.tsx
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Bot, Save, Loader2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import type { CodeSymbol, GeneratedDoc } from '@/types';

interface DocumentationLensProps {
    symbol: CodeSymbol;
    generatedDoc: GeneratedDoc | null;
    onGenerateDoc: () => void;
    isGenerating: boolean;
    onSaveDoc: (docToSave: string) => void;
    isSaving: boolean;
}

export const DocumentationLens: React.FC<DocumentationLensProps> = ({
    symbol,
    generatedDoc,
    onGenerateDoc,
    isGenerating,
    onSaveDoc,
    isSaving,
}) => {
    const [isExistingDocOpen, setIsExistingDocOpen] = useState(false);
    const [isAiSuggestionOpen, setIsAiSuggestionOpen] = useState(true);

    const hasPersistedDocumentation = symbol.documentation && symbol.documentation.trim().length > 0;
    const hasAiSuggestion = generatedDoc && generatedDoc.markdown.trim().length > 0;

    const handleSaveClick = () => {
        if (generatedDoc) onSaveDoc(generatedDoc.markdown);
    };

    const handleGenerateClick = () => {
        setIsExistingDocOpen(false);
        setIsAiSuggestionOpen(true);
        onGenerateDoc();
    };

    const formattedAiDoc = useMemo(() => {
        if (!hasAiSuggestion) return null;
        // Your existing formatting logic for the AI doc
        return generatedDoc.markdown.split('\n').map((line, index) => <span key={index}>{line}<br /></span>);
    }, [generatedDoc, hasAiSuggestion]);

    const isDisabled = isGenerating || isSaving;

    return (
        <div className="space-y-3 pt-2">
            {hasPersistedDocumentation && (
                <Collapsible open={isExistingDocOpen} onOpenChange={setIsExistingDocOpen}>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="lg" className="w-full justify-start text-sm h-auto py-2 px-2">
                            {isExistingDocOpen ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                            {isExistingDocOpen ? 'Hide Existing Documentation' : 'Show Existing Documentation'}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-1">
                        <div className="text-sm whitespace-pre-wrap bg-background/70 p-3 rounded-md border font-mono text-muted-foreground max-h-48 overflow-y-auto">
                            {symbol.documentation}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            {hasAiSuggestion && (
                <Collapsible open={isAiSuggestionOpen} onOpenChange={setIsAiSuggestionOpen} className="border rounded-lg">
                    <CollapsibleTrigger className="p-3 w-full flex justify-between items-center text-sm font-semibold">
                        AI Suggestion
                        {isAiSuggestionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3">
                        <div className="text-sm whitespace-pre-wrap bg-background/70 p-3 rounded-md border font-mono max-h-60 overflow-y-auto">
                            {formattedAiDoc}
                        </div>
                        <Button size="sm" onClick={handleSaveClick} disabled={isDisabled} className="w-full mt-3">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            {isSaving ? 'Saving...' : 'Save Suggestion'}
                        </Button>
                    </CollapsibleContent>
                </Collapsible>
            )}

            <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateClick} // This now works for both generate and regenerate
                disabled={isGenerating || isSaving}
                className="w-full"
            >
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                {isGenerating ? 'Generating...' : (hasPersistedDocumentation || hasAiSuggestion ? 'Regenerate Suggestion' : 'Generate Documentation')}
            </Button>
        </div>
    );
};