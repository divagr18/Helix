// src/components/repo-detail/SymbolListItem.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FaRobot, FaSave, FaSpinner, FaRulerCombined, FaBrain } from 'react-icons/fa'; // Existing icons
import { Code, Settings2, Edit3, Trash2, GitPullRequest } from 'lucide-react'; // New Lucide icons

import { StatusIcon } from '../StatusIcon';
import { OrphanIndicator } from '../OrphanIndicator';

// shadcn/ui components
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"


// Assuming types are defined centrally or passed down correctly
interface CodeSymbolForListItem { // Renamed to avoid conflict if CodeSymbol is also imported
    id: number;
    name: string;
    start_line: number;
    end_line: number;
    documentation: string | null;
    content_hash: string | null;
    documentation_hash: string | null;
    documentation_status: string | null;
    is_orphan?: boolean;
    loc?: number;
    cyclomatic_complexity?: number;
    unique_id?: string; // For more context if needed
    // Optional, to indicate if it's a method and from which class
    parent_class_name?: string;
}

interface SymbolListItemProps {
    symbol: CodeSymbolForListItem;
    generatedDoc: string | undefined; // Specific generated doc for this symbol
    onGenerateDoc: (symbolId: number) => void;
    isGeneratingDoc: boolean; // True if AI is generating for THIS symbol
    onSaveDoc: (symbolId: number) => void;
    isSavingDoc: boolean; // True if saving for THIS symbol
    // Disable all AI/Save buttons if a global operation is in progress for the file/repo
    isGlobalOperationInProgress: boolean;
}

export const SymbolListItem: React.FC<SymbolListItemProps> = ({
    symbol,
    generatedDoc,
    onGenerateDoc,
    isGeneratingDoc,
    onSaveDoc,
    isSavingDoc,
    isGlobalOperationInProgress,
}) => {

    const handleGenerateClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card click or other parent events if any
        onGenerateDoc(symbol.id);
    };

    const handleSaveClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSaveDoc(symbol.id);
    };

    // Determine if the "Generate" button should be for "Regenerate"
    const generateButtonText = symbol.documentation ? 'Regenerate' : 'Generate';

    return (
        // Using shadcn/ui Card for each symbol item
        <Card className="mb-4 bg-card hover:shadow-lg transition-shadow duration-200 ease-in-out"> {/* bg-card or a slightly different shade like bg-background if cards are inside a bg-card panel */}
            <CardHeader className="pb-2 pt-3 px-4"> {/* Reduced padding */}
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold leading-none tracking-tight">
                        <Link
                            to={`/symbol/${symbol.id}`}
                            className="hover:underline text-primary" // Use primary for link
                            title={`View details for ${symbol.name}`}
                        >
                            {symbol.parent_class_name && (
                                <span className="text-xs text-muted-foreground mr-1">{symbol.parent_class_name}.</span>
                            )}
                            {symbol.name}
                        </Link>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                        <StatusIcon
                            documentationStatus={symbol.documentation_status}
                            hasDoc={!!symbol.documentation}
                            contentHash={symbol.content_hash}
                            docHash={symbol.documentation_hash}
                        />
                        <OrphanIndicator isOrphan={symbol.is_orphan} />
                    </div>
                </div>
                <CardDescription className="text-xs text-muted-foreground pt-1 flex items-center space-x-3">
                    <span>Lines: {symbol.start_line} - {symbol.end_line}</span>
                    {typeof symbol.loc === 'number' && (
                        <span title={`Lines of Code: ${symbol.loc}`} className="flex items-center">
                            <Code size={12} className="mr-1 opacity-70" /> {symbol.loc}
                        </span>
                    )}
                    {typeof symbol.cyclomatic_complexity === 'number' && (
                        <span title={`Cyclomatic Complexity: ${symbol.cyclomatic_complexity}`} className="flex items-center">
                            <Settings2 size={12} className="mr-1 opacity-70" /> {symbol.cyclomatic_complexity}
                        </span>
                    )}
                </CardDescription>
            </CardHeader>

            <CardContent className="px-4 pb-3 pt-1"> {/* Reduced padding */}
                {/* Existing Documentation (collapsible) */}
                {symbol.documentation && !generatedDoc && (
                    <Accordion type="single" collapsible className="w-full text-xs">
                        <AccordionItem value="item-1" className="border-b-0"> {/* Remove default border */}
                            <AccordionTrigger className="py-1 hover:no-underline text-muted-foreground hover:text-foreground [&[data-state=open]>svg]:text-primary">
                                View Saved Documentation
                            </AccordionTrigger>
                            <AccordionContent className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap bg-background/50 p-3 rounded-md max-h-[150px] overflow-y-auto text-foreground/80">
                                {/* prose-sm for nice text formatting, dark:prose-invert for dark mode text */}
                                {symbol.documentation}
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                )}

                {/* AI Generated Docstring Suggestion */}
                {generatedDoc && (
                    <div className="mt-3 text-xs border border-primary/30 bg-primary/5 p-3 rounded-md">
                        <h4 className="mb-2 font-semibold text-primary text-sm">AI Generated Suggestion:</h4>
                        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap max-h-[200px] overflow-y-auto text-foreground/90">
                            {generatedDoc}
                        </div>
                        <Button
                            onClick={handleSaveClick}
                            disabled={isSavingDoc || isGlobalOperationInProgress}
                            variant="default" // Primary button for saving
                            size="sm"
                            className="w-full mt-3"
                        >
                            {isSavingDoc ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Edit3 className="mr-2 h-4 w-4" /> // Using Edit3 for "Save/Apply Edit"
                            )}
                            {isSavingDoc ? 'Saving...' : 'Save Suggestion'}
                        </Button>
                    </div>
                )}
            </CardContent>

            <CardFooter className="px-4 pb-3 pt-1"> {/* Reduced padding */}
                <Button
                    onClick={handleGenerateClick}
                    disabled={isGeneratingDoc || isSavingDoc || isGlobalOperationInProgress}
                    variant="outline" // Outline button for generate/regenerate
                    size="sm"
                    className="w-full"
                >
                    {isGeneratingDoc ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <FaRobot className="mr-2 h-4 w-4" /> // Keep FaRobot if you like it, or use a Lucide icon
                    )}
                    {isGeneratingDoc ? 'Generating...' : generateButtonText}
                </Button>
            </CardFooter>
        </Card>
    );
};