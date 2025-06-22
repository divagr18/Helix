// src/components/symbol-detail/AiInsightsTab.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Import Tabs
import { BrainCircuit, Loader2, TriangleAlert, Sparkles, FlaskConical, Copy } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';

// Reusing SourceCodeViewer for test case syntax highlighting
import { SourceCodeViewer } from './SourceCodeViewer';

interface AiInsightsTabProps {
    // Explanation Props
    onExplainCode: () => void;
    isExplaining: boolean;
    explanation: string | null;
    explanationError: string | null;

    // Test Case Props
    onSuggestTests: () => void;
    isSuggestingTests: boolean;
    testSuggestion: string | null;
    testSuggestionError: string | null;
}

export const AiInsightsTab: React.FC<AiInsightsTabProps> = ({
    onExplainCode,
    isExplaining,
    explanation,
    explanationError,
    onSuggestTests,
    isSuggestingTests,
    testSuggestion,
    testSuggestionError,
}) => {

    const handleCopyToClipboard = (textToCopy: string | null) => {
        if (!textToCopy) return;
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast.success("Copied to clipboard!");
        }).catch(err => {
            console.error("Failed to copy:", err);
            toast.error("Failed to copy to clipboard.");
        });
    };

    return (
        <Card
            className="col-span-1 md:col-span-2 flex flex-col border border-border bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-shadow duration-300 overflow-hidden"
        >
            <Tabs defaultValue="explanation" className="flex flex-col h-full">
                <CardHeader className="pb-0 pt-3 px-4">
                    <div className="flex items-center justify-between gap-4">
                        <CardTitle className="text-base md:text-lg flex items-center">
                            <Sparkles className="mr-2 h-5 w-5 text-primary" />
                            Helix AI Insights
                        </CardTitle>
                        {/* The TabsList will serve as our primary navigation within the card */}
                        <TabsList className="grid w-full max-w-[220px] grid-cols-2 h-9">
                            <TabsTrigger value="explanation">
                                <BrainCircuit className="mr-2 h-4 w-4" /> Explanation
                            </TabsTrigger>
                            <TabsTrigger value="tests">
                                <FlaskConical className="mr-2 h-4 w-4" /> Tests
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </CardHeader>

                <CardContent className="flex-grow flex flex-col p-4">
                    {/* Explanation Tab Content */}
                    <TabsContent value="explanation" className="flex-grow flex flex-col mt-0">
                        <div className="flex-grow border-t border-border pt-4 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-muted-foreground">A natural language summary of this symbol.</p>
                                <Button onClick={onExplainCode} disabled={isExplaining} variant="outline" size="sm">
                                    {isExplaining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    {isExplaining ? 'Analyzing...' : (explanation ? 'Regenerate' : 'Explain')}
                                </Button>
                            </div>
                            <div className="flex-grow min-h-[200px] relative">
                                {isExplaining && !explanation && (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/30 rounded-md">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                )}
                                {explanationError && <Alert variant="destructive"><TriangleAlert className="h-4 w-4" /><AlertDescription>{explanationError}</AlertDescription></Alert>}
                                {explanation && !explanationError && (
                                    <ScrollArea className="h-full max-h-72 pr-3">
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-left">
                                            <Markdown remarkPlugins={[remarkGfm]}>{explanation}</Markdown>
                                        </div>
                                    </ScrollArea>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* Test Cases Tab Content */}
                    <TabsContent value="tests" className="flex-grow flex flex-col mt-0">
                        <div className="flex-grow border-t border-border pt-4 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-muted-foreground">Pytest boilerplate for key test cases.</p>
                                <Button onClick={onSuggestTests} disabled={isSuggestingTests} variant="outline" size="sm">
                                    {isSuggestingTests ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                                    {isSuggestingTests ? 'Generating...' : (testSuggestion ? 'Regenerate' : 'Suggest Tests')}
                                </Button>
                            </div>
                            <div className="flex-grow min-h-[200px] relative">
                                {isSuggestingTests && !testSuggestion && (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/30 rounded-md">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                )}
                                {testSuggestionError && <Alert variant="destructive"><TriangleAlert className="h-4 w-4" /><AlertDescription>{testSuggestionError}</AlertDescription></Alert>}
                                {testSuggestion && !testSuggestionError && (
                                    <div className="relative h-full">
                                        <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10 h-7 w-7" onClick={() => handleCopyToClipboard(testSuggestion)}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        {/* Reuse your existing SourceCodeViewer for syntax highlighting */}
                                        <SourceCodeViewer sourceCode={testSuggestion} language="python" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </CardContent>
            </Tabs>
        </Card>
    );
};