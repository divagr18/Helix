// src/components/symbol-detail/CodeExplanationSection.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BrainCircuit, Loader2, TriangleAlert, Sparkles } from 'lucide-react'; // Using Sparkles for a more "magical" AI feel
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface CodeExplanationSectionProps {
    onExplainCode: () => void;
    isExplaining: boolean;
    explanation: string | null;
    error: string | null;
}

export const CodeExplanationSection: React.FC<CodeExplanationSectionProps> = ({
    onExplainCode,
    isExplaining,
    explanation,
    error,
}) => {
    const hasExplanationContent = explanation && explanation.trim().length > 0;
    const hasError = error && error.trim().length > 0;
    const hasContent = hasExplanationContent || hasError;

    return (
        <Card
            className="col-span-1 flex flex-col border border-border bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-shadow duration-300 overflow-hidden"
        >
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-base md:text-lg flex items-center">
                        <BrainCircuit className="mr-2 h-5 w-5 text-primary" />
                        Helix's Explanation
                    </CardTitle>
                    <Button
                        onClick={onExplainCode}
                        disabled={isExplaining}
                        variant="outline"
                        size="sm"
                        className="border-primary/20 hover:bg-primary/10 hover:text-primary-foreground flex-shrink-0"
                    >
                        {isExplaining ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4 text-primary/80" />
                        )}
                        {isExplaining ? 'Analyzing...' : (hasExplanationContent ? 'Regenerate' : 'Explain Code')}
                    </Button>
                </div>
                <CardDescription className="text-xs pt-1">
                    A natural language summary of this symbol's purpose and logic.
                </CardDescription>
            </CardHeader>

            {/* This CardContent will now act as the main container for all states */}
            <CardContent className="flex-grow flex flex-col p-4 pt-0">
                <div className="flex-grow border-t border-border pt-4">
                    {/* We use a single container and conditionally render content inside it */}
                    {isExplaining ? (
                        // Loading State: Centered spinner
                        <div className="flex h-full min-h-[150px] items-center justify-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <p className="text-sm">Helix is analyzing the code...</p>
                            </div>
                        </div>
                    ) : hasContent ? (
                        // Content or Error State: Scrollable, left-aligned
                        <ScrollArea className="h-full max-h-72 pr-3"> {/* Set a max-height */}
                            <div className="prose prose-sm dark:prose-invert max-w-none text-left">
                                {hasError ? (
                                    <Alert variant="destructive" className="text-xs p-3 border-2">
                                        <TriangleAlert className="mr-2 h-4 w-4" />
                                        <AlertDescription>{error}</AlertDescription>
                                    </Alert>
                                ) : (
                                    <Markdown remarkPlugins={[remarkGfm]}>
                                        {explanation || ''}
                                    </Markdown>
                                )}
                            </div>
                        </ScrollArea>
                    ) : (
                        // Initial/Empty State: Left-aligned prompt
                        <div className="flex h-full min-h-[150px] items-start justify-start text-left text-muted-foreground p-1">
                            <p className="text-sm">
                                Click <span className="font-semibold text-foreground">"Explain Code"</span> to have Helix analyze this symbol and provide a summary of its purpose and logic.
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};