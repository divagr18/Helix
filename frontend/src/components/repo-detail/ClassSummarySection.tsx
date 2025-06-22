// src/components/repo-detail/ClassSummarySection.tsx
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Sparkles, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { getCookie } from '@/utils'; // Assuming you have this utility
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
interface ClassSummarySectionProps {
    classId: number;
}

export const ClassSummarySection: React.FC<ClassSummarySectionProps> = ({ classId }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(false); // To control the collapsible

    const handleGenerateSummary = useCallback(async () => {
        if (summary && !isOpen) {
            setIsOpen(true);
            return;
        }
        setIsLoading(true);
        setError(null);
        setSummary(""); // Clear previous summary, set to empty for streaming
        setIsOpen(true); // Automatically open the collapsible when generating

        toast.info("Helix is summarizing the class...");

        try {
            const response = await fetch(
                `http://localhost:8000/api/v1/classes/${classId}/summarize/`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' },
                }
            );

            if (!response.ok || !response.body) {
                const errorText = await response.text();
                throw new Error(errorText || `Failed to generate summary (status: ${response.status})`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let streamedText = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    // When the stream is done, decode any final bytes that might be in the buffer.
                    // This can sometimes include the very last characters like ```
                    const finalChunk = decoder.decode();
                    if (finalChunk) {
                        streamedText += finalChunk;
                        setSummary(streamedText);
                    }
                    break; // Exit the loop
                }

                const chunk = decoder.decode(value, { stream: true });
                // ... your error checking for the chunk ...
                streamedText += chunk;
                setSummary(streamedText);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(errorMessage);
            toast.error("Summary Failed", { description: errorMessage });
        } finally {
            setIsLoading(false);
        }
    }, [classId, summary, isOpen]);

    // Render the button only if no summary has been generated yet
    if (!summary && !isLoading && !error) {
        return (
            <Button onClick={handleGenerateSummary} variant="outline" size="sm" className="w-full justify-center text-xs">
                <Sparkles className="mr-2 h-3.5 w-3.5" />
                Summarize Class with Helix
            </Button>
        );
    }

    // Render the collapsible section once an attempt has been made
    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full space-y-2">
            <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex-grow justify-start text-xs text-muted-foreground hover:text-foreground -ml-2">
                        {isOpen ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                        <span>
                            {isLoading ? "Helix is thinking..." : (error ? "Error Occurred" : "Helix Class Summary")}
                        </span>
                    </Button>
                </CollapsibleTrigger>
                {/* Add a Regenerate button that appears only when not loading */}
                {!isLoading && (
                    <Button onClick={handleGenerateSummary} variant="ghost" size="icon-sm" className="h-7 w-7 text-muted-foreground hover:text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
            <CollapsibleContent>
                <div className="rounded-md border border-border bg-background/50 p-3 text-left">
                    {isLoading && !summary && (
                        <div className="flex items-center justify-center text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                    )}
                    {error ? (
                        <p className="text-destructive flex items-center text-sm">
                            <AlertCircle className="h-4 w-4 mr-2" />
                            {error}
                        </p>
                    ) : isLoading ? (
                        <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                            {summary || <Loader2 className="h-4 w-4 animate-spin" />}
                        </pre>
                    ) : (
                        <Markdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // code blocks (with your Prism highlighter)
                                code({ inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || "");
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            language={match[1]}
                                            style={oneDark}
                                            PreTag="div"
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, "")}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    );
                                },

                                // headings
                                h1({ children, ...props }) {
                                    return (
                                        <h1 className="text-2xl font-bold mb-4 mt-6" {...props}>
                                            {children}
                                        </h1>
                                    );
                                },
                                h2({ children, ...props }) {
                                    return (
                                        <h2 className="text-xl font-semibold mb-3 mt-5" {...props}>
                                            {children}
                                        </h2>
                                    );
                                },
                                h3({ children, ...props }) {
                                    return (
                                        <h3 className="text-lg font-medium mb-2 mt-4" {...props}>
                                            {children}
                                        </h3>
                                    );
                                },
                                // lists
                                ul({ children, ...props }) {
                                    return (
                                        <ul className="list-disc list-inside ml-4 mb-4" {...props}>
                                            {children}
                                        </ul>
                                    );
                                },
                                ol({ children, ...props }) {
                                    return (
                                        <ol className="list-decimal list-inside ml-4 mb-4" {...props}>
                                            {children}
                                        </ol>
                                    );
                                },
                                // paragraphs
                                p({ children, ...props }) {
                                    return (
                                        <p className="mb-3 leading-relaxed text-sm" {...props}>
                                            {children}
                                        </p>
                                    );
                                },
                            }}
                        >
                            {summary || ""}
                        </Markdown>
                    )}
                </div>
            </CollapsibleContent>

        </Collapsible>
    );
};