// src/components/symbol-detail/DocumentationSection.tsx
import React, { useState, useEffect } from 'react';
import { Bot, Edit3, Save, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { type CodeSymbol as PageSymbolDetail } from '@/types'; // Use the type from src/types

interface DocumentationSectionProps {
    symbolId: number;
    initialDocumentation: string | null;
    // initialDocumentationStatus: string | null; // No longer directly used for rendering by this component
    onGenerateAIDoc: () => Promise<string | null>;
    isGeneratingAIDoc: boolean;
    onSaveDoc: (docText: string) => Promise<boolean>;
    onDocumentationUpdate: (updatedSymbolData: Partial<PageSymbolDetail>) => void;
}

export const DocumentationSection: React.FC<DocumentationSectionProps> = ({
    // symbolId, // Available if needed for future logic within this component
    initialDocumentation,
    onGenerateAIDoc,
    isGeneratingAIDoc: parentIsGeneratingAIDoc,
    onSaveDoc,
    onDocumentationUpdate,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedDoc, setEditedDoc] = useState(initialDocumentation || "");
    const [aiGeneratedDoc, setAiGeneratedDoc] = useState<string | null>(null);
    const [isGeneratingThisAIDoc, setIsGeneratingThisAIDoc] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isExistingDocOpen, setIsExistingDocOpen] = useState(true);

    useEffect(() => {
        if (!isEditing) {
            setEditedDoc(initialDocumentation || "");
        }
    }, [initialDocumentation, isEditing]);

    const handleEditClick = () => {
        setEditedDoc(aiGeneratedDoc !== null ? aiGeneratedDoc : (initialDocumentation || ""));
        setAiGeneratedDoc(null);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setEditedDoc(initialDocumentation || "");
        setAiGeneratedDoc(null);
        setIsEditing(false);
        setSaveError(null);
    };

    const handleGenerateAndEdit = async () => {
        setIsGeneratingThisAIDoc(true);
        setAiGeneratedDoc(null);
        setIsEditing(false);
        setSaveError(null);

        const streamedDoc = await onGenerateAIDoc();

        if (streamedDoc !== null) {
            setAiGeneratedDoc(streamedDoc);
            setEditedDoc(streamedDoc);
            setIsEditing(true);
        } else {
            setAiGeneratedDoc("// AI generation failed. Check console or try again.");
        }
        setIsGeneratingThisAIDoc(false);
    };

    const handleSaveClick = async () => {
        setIsSaving(true);
        setSaveError(null);
        const success = await onSaveDoc(editedDoc);
        if (success) {
            setIsEditing(false);
            setAiGeneratedDoc(null);
            // Inform parent about the update
            onDocumentationUpdate({ documentation: editedDoc, documentation_status: 'FRESH' });
        } else {
            setSaveError("Failed to save documentation. Please try again.");
        }
        setIsSaving(false);
    };

    const currentDisplayDoc = aiGeneratedDoc !== null ? aiGeneratedDoc : initialDocumentation;
    const hasContentToDisplay = currentDisplayDoc && currentDisplayDoc.trim().length > 0;

    return (
        <div className="space-y-3"> {/* Main container for this section's content */}
            {!isEditing && (
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleEditClick} disabled={parentIsGeneratingAIDoc || isGeneratingThisAIDoc}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                    </Button>
                    <Button variant="default" size="sm" onClick={handleGenerateAndEdit} disabled={parentIsGeneratingAIDoc || isGeneratingThisAIDoc}>
                        {parentIsGeneratingAIDoc || isGeneratingThisAIDoc ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Bot className="mr-2 h-4 w-4" />
                        )}
                        {parentIsGeneratingAIDoc || isGeneratingThisAIDoc ? 'Generating...' : (initialDocumentation ? 'Regenerate AI Doc' : 'Generate AI Doc')}
                    </Button>
                </div>
            )}

            {isEditing ? (
                <div className="space-y-3">
                    <Textarea
                        value={editedDoc}
                        onChange={(e) => setEditedDoc(e.target.value)}
                        placeholder="Enter documentation here..."
                        className="min-h-[180px] md:min-h-[200px] font-mono text-sm"
                        disabled={isSaving}
                    />
                    {saveError && <Alert variant="destructive" className="mt-2"><AlertDescription>{saveError}</AlertDescription></Alert>}
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={handleSaveClick} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    {(parentIsGeneratingAIDoc || isGeneratingThisAIDoc) && !aiGeneratedDoc && (
                        <div className="flex items-center text-muted-foreground p-3 border border-dashed border-border rounded-md min-h-[80px]">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            AI is thinking...
                        </div>
                    )}
                    {hasContentToDisplay ? (
                        <Collapsible open={isExistingDocOpen} onOpenChange={setIsExistingDocOpen} className="mt-1">
                            <CollapsibleTrigger asChild>
                                <Button variant="link" size="sm" className="p-0 h-auto text-xs text-muted-foreground mb-1">
                                    {isExistingDocOpen ? <EyeOff className="mr-1 h-3 w-3" /> : <Eye className="mr-1 h-3 w-3" />}
                                    {isExistingDocOpen ? 'Hide' : 'Show'} {aiGeneratedDoc !== null ? "AI Suggestion" : "Documentation"}
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <div className="prose prose-sm dark:prose-invert max-w-none p-3 border border-border rounded-md whitespace-pre-wrap bg-muted/30 min-h-[80px]">
                                    {currentDisplayDoc}
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    ) : !(parentIsGeneratingAIDoc || isGeneratingThisAIDoc) && (
                        <div className="text-muted-foreground p-3 border border-dashed border-border rounded-md min-h-[80px]">
                            No documentation available. Click "Generate AI Doc" or "Edit" to add.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};