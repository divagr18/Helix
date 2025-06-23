// src/components/symbol-detail/AiInsightsTab.tsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Import Tabs
import { BrainCircuit, Wrench, Loader2, TriangleAlert, Sparkles, FlaskConical, Copy } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// Choose your theme. `vscDarkPlus` is a great choice for a dark theme.
// Other options: `oneDark`, `materialDark`, `coldarkDark`, etc.
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Reusing SourceCodeViewer for test case syntax highlighting
import { SourceCodeViewer } from './SourceCodeViewer';
import remarkBreaks from 'remark-breaks';

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

    onSuggestRefactors: () => void;
    isSuggestingRefactors: boolean;
    refactorSuggestion: string | null;
    refactorError: string | null;
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
    onSuggestRefactors,
    isSuggestingRefactors,
    refactorSuggestion,
    refactorError,
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
                        <TabsList className="grid w-full max-w-[330px] grid-cols-3 h-9">
                            <TabsTrigger value="explanation">
                                <BrainCircuit className="mr-2 h-4 w-4" /> Explanation
                            </TabsTrigger>
                            <TabsTrigger value="tests">
                                <FlaskConical className="mr-2 h-4 w-4" /> Tests
                            </TabsTrigger>
                            <TabsTrigger value="refactor">
                                <Wrench className="mr-2 h-4 w-4" /> Refactor
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
                    <TabsContent value="refactor" className="flex-grow flex flex-col mt-0">
                        <div className="flex-grow border-t border-border pt-4 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm text-muted-foreground">Suggestions to improve code quality.</p>
                                <Button
                                    onClick={onSuggestRefactors}
                                    disabled={isSuggestingRefactors}
                                    variant="outline"
                                    size="sm"
                                >
                                    {isSuggestingRefactors
                                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        : <Wrench className="mr-2 h-4 w-4" />}
                                    {isSuggestingRefactors
                                        ? 'Analyzing...'
                                        : (refactorSuggestion ? 'Regenerate' : 'Suggest Refactors')}
                                </Button>
                            </div>

                            <div className="flex-grow min-h-[200px] relative">
                                {isSuggestingRefactors && !refactorSuggestion && (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground bg-background/30 rounded-md">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                )}

                                {refactorError && (
                                    <Alert variant="destructive">
                                        <TriangleAlert className="h-4 w-4" />
                                        <AlertDescription>{refactorError}</AlertDescription>
                                    </Alert>
                                )}

                                {refactorSuggestion && !refactorError && (
                                    <ScrollArea className="h-full max-h-72 pr-3">
                                        <div className="prose prose-sm dark:prose-invert max-w-none text-left">
                                            <Markdown
                                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                                components={{
                                                    hr() {
                                                        return <div className="my-12" />;  // my-12 ≈ 3rem top & bottom padding
                                                    },
                                                    h2({ node, children, ...props }) {
                                                        return (
                                                            <h2
                                                                className="text-2xl md:text-3xl font-semibold mt-8 mb-4"
                                                                {...props}
                                                            >
                                                                {children}
                                                            </h2>
                                                        );
                                                    },
                                                    code({ node, inline, className, children, ...props }) {
                                                        const match = /language-(\w+)/.exec(className || '');

                                                        if (!inline && match) {
                                                            return (
                                                                <SyntaxHighlighter
                                                                    style={vscDarkPlus}
                                                                    language={match[1]}
                                                                    PreTag="div"
                                                                    {...props}
                                                                >
                                                                    {String(children).replace(/\n$/, '')}
                                                                </SyntaxHighlighter>
                                                            );
                                                        }

                                                        return (
                                                            <code className={className} {...props}>
                                                                {children}
                                                            </code>
                                                        );
                                                    }
                                                }}
                                            >
                                                {refactorSuggestion}
                                            </Markdown>
                                        </div>
                                    </ScrollArea>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </CardContent>
            </Tabs>
        </Card>
    );
};