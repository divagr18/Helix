// src/components/testing/SymbolTestGeneratorPanel.tsx
import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { type CodeFile, type CodeSymbol } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Loader2 } from 'lucide-react';
import Editor, { type BeforeMount } from '@monaco-editor/react';
import { getCookie } from '@/utils/cookies';
import { Play, Copy } from 'lucide-react';
import { TestRunResults } from './TestRunResults';
export const SymbolTestGeneratorPanel: React.FC<{ file: CodeFile; sourceCode: string | null }> = ({ file, sourceCode }) => {
    const [selectedSymbolIds, setSelectedSymbolIds] = useState<Set<number>>(new Set());
    const [generatedTests, setGeneratedTests] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testRunResult, setTestRunResult] = useState<any>(null)

    // Flatten all symbols from the file into a single list
    const allSymbols = useMemo(() => {
        return [
            ...file.symbols,
            ...file.classes.flatMap(cls => cls.methods.map(m => ({ ...m, className: cls.name })))
        ].sort((a, b) => a.start_line - b.start_line);
    }, [file]);

    const handleToggleSymbol = (id: number) => {
        setSelectedSymbolIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleGenerateTests = async () => {
        if (selectedSymbolIds.size === 0) {
            toast.warning("No symbols selected.");
            return;
        }

        setIsLoading(true);
        setGeneratedTests(""); // Clear previous results
        toast.info(`Generating a cohesive test file for ${selectedSymbolIds.size} symbol(s)...`);

        const payload = {
            symbol_ids: Array.from(selectedSymbolIds)
        };

        try {
            // --- THIS IS THE CORRECT STREAMING IMPLEMENTATION ---
            const response = await fetch('/api/v1/generate-cohesive-tests/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken') || '', // Ensure CSRF token is included
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                // Handle HTTP errors like 404 or 500
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            if (!response.body) {
                throw new Error("Response has no body to read.");
            }

            // Use the browser's native ReadableStream API
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break; // The stream has finished
                }
                const chunk = decoder.decode(value, { stream: true });
                // Update the state with each new chunk to render the stream live
                setGeneratedTests(prev => prev + chunk);
            }
            // --- END CORRECT STREAMING IMPLEMENTATION ---

            toast.success("Test generation complete.");

        } catch (error) {
            console.error("Failed to generate cohesive test file:", error);
            toast.error("Failed to generate test file.", { description: String(error) });
        } finally {
            setIsLoading(false);
        }
    };

    const finalTestCode = generatedTests;
    const handleEditorWillMount: BeforeMount = (monaco) => {
        monaco.editor.defineTheme('true-black', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#080808',
                'editor.foreground': '#FFFFFF',
                'editorLineNumber.foreground': '#858585',
                'editorLineNumber.activeForeground': '#FFFFFF',
                'editor.selectionBackground': '#264F78',
                'editor.inactiveSelectionBackground': '#3A3D41'
            }
        });
    };
    const handleRunTests = async () => {
        if (!sourceCode || !generatedTests) {
            toast.error("Missing source code or generated tests to run.");
            return;
        }
        setIsTesting(true);
        setTestRunResult(null);
        toast.info("Running tests in a secure sandbox...");

        try {
            const response = await axios.post('/api/v1/testing/run-sandbox/', {
                source_code: sourceCode,
                test_code: generatedTests,
            });
            // Here you would start polling the task ID from response.data.task_id
            // For now, we'll just simulate the result.
            // In a real app: pollTaskStatus(response.data.task_id).then(setTestRunResult);
            toast.success("Test run complete!");
        } catch (error) {
            toast.error("Failed to start test run.");
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="h-full grid grid-cols-[40%_60%]">
            {/* Left side: Symbol selection */}
            <div className="flex flex-col border-r h-full">
                <div className="p-4 border-b flex-shrink-0">
                    <h3 className="font-semibold">Select Symbols to Test</h3>
                    <p className="text-xs text-muted-foreground">{file.file_path}</p>
                </div>
                <ScrollArea className="flex-grow">
                    <div className="p-4 space-y-3">
                        {allSymbols.map(symbol => (
                            <div key={symbol.id} className="flex items-center space-x-3">
                                <Checkbox
                                    id={`symbol-${symbol.id}`}
                                    checked={selectedSymbolIds.has(symbol.id)}
                                    onCheckedChange={() => handleToggleSymbol(symbol.id)}
                                />
                                <label htmlFor={`symbol-${symbol.id}`} className="text-sm font-mono cursor-pointer">
                                    {symbol.name}
                                    {symbol.className && <span className="text-xs text-muted-foreground ml-2">({symbol.className})</span>}
                                </label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-4 border-t mt-auto flex-shrink-0">
                    <Button onClick={handleGenerateTests} disabled={isLoading || selectedSymbolIds.size === 0} className="w-full">
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                        Generate Tests for Selected ({selectedSymbolIds.size})
                    </Button>
                </div>
            </div>

            {/* Right side: Test code display */}
            <div className="h-full flex flex-col">
                <div className="p-4 border-b flex-shrink-0 flex justify-between items-center">
                    <div>
                        <h3 className="font-semibold">Generated Test Code</h3>
                        <p className="text-xs text-muted-foreground">Review, copy, and run the generated tests.</p>
                    </div>
                    {/* --- NEW BUTTONS --- */}
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(generatedTests)} disabled={!generatedTests}>
                            <Copy className="mr-2 h-4 w-4" /> Copy
                        </Button>
                        <Button onClick={handleRunTests} disabled={!generatedTests || isTesting}>
                            {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Run Tests
                        </Button>
                    </div>
                </div>

                <div className="flex-grow min-h-0">
                    <Editor
                        height="100%"
                        language="python"
                        value={finalTestCode}
                        theme="vs-dark"
                        options={{ readOnly: true, minimap: { enabled: false } }}
                    />
                    {testRunResult && (
                        <div className="absolute bottom-0 left-0 right-0">
                            <TestRunResults result={testRunResult} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};