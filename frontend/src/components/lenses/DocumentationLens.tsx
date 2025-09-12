// src/components/lenses/DocumentationLens.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Save, RefreshCw } from 'lucide-react';
import type { CodeSymbol, GeneratedDoc } from '@/types';
import { cn } from '@/lib/utils';

interface DocumentationLensProps {
    symbol: CodeSymbol;
    generatedDoc: GeneratedDoc | null;
    onGenerateDoc: () => void;
    isGenerating: boolean;
    onSaveDoc: (docToSave: string) => void;
    isSaving: boolean;
    // A new prop to check if any other action is happening that should disable buttons
    isAnyOtherActionInProgress: boolean;
}

export const DocumentationLens: React.FC<DocumentationLensProps> = ({
    symbol,
    generatedDoc,
    onGenerateDoc,
    isGenerating,
    onSaveDoc,
    isSaving,
    isAnyOtherActionInProgress,
}) => {
    // --- THIS IS THE FIX ---
    // Prioritize the `existing_docstring` field from the API response.
    // The `documentation` field might be used for something else (like staged changes),
    // but `existing_docstring` represents what's actually in the code.
    const [docContent, setDocContent] = useState(symbol.existing_docstring || '');

    useEffect(() => {
        if (generatedDoc) {
            setDocContent(generatedDoc.markdown);
        } else {
            // When the symbol changes, reset the content to its existing docstring.
            setDocContent(symbol.existing_docstring || '');
        }
    }, [symbol.existing_docstring, generatedDoc]);

    // The check for an existing doc should also use the correct field.
    const hasExistingDoc = !!symbol.existing_docstring;
    // --- END FIX ---

    const hasGeneratedDoc = !!generatedDoc;
    const hasContent = docContent.trim().length > 0;

    // This logic checks if the current content differs from what's saved in the database
    const isDirty = docContent !== (symbol.existing_docstring || '') && docContent.trim().length > 0;

    const handleSaveClick = () => {
        if (isDirty) {
            onSaveDoc(docContent);
        }
    };

    const isActionDisabled = isGenerating || isSaving || isAnyOtherActionInProgress;

    return (
        <div className="space-y-3">
            {/* --- The Text Area --- */}
            <div className="relative">
                <Textarea
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    placeholder={isGenerating ? "Helix is thinking..." : "No documentation exists. Click Generate to create one."}
                    className="w-full min-h-[120px] bg-card/60 border-border/80 rounded-md"
                    disabled={isGenerating}
                />
                {isGenerating && (
                    <div className="absolute inset-0 flex items-center justify-center bg-card/50">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                )}
            </div>

            {/* --- The Action Buttons --- */}
            <div className="flex items-center justify-end gap-2">
                {/* Show "Regenerate" if docs exist (either existing or generated), otherwise "Generate" */}
                {(hasExistingDoc || hasGeneratedDoc) && (
                    <Button variant="outline" size="sm" onClick={onGenerateDoc} disabled={isActionDisabled}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerate
                    </Button>
                )}

                {!hasExistingDoc && !hasGeneratedDoc && (
                    <Button variant="default" size="sm" onClick={onGenerateDoc} disabled={isActionDisabled} className="bg-blue-600 hover:bg-blue-700">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate
                    </Button>
                )}

                {/* The Save button is only visible and enabled when there is content that has been changed */}
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleSaveClick}
                    disabled={!isDirty || !hasContent || isActionDisabled}
                    className={cn(!isDirty && "opacity-50")}
                >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Changes
                </Button>
            </div>
        </div>
    );
};