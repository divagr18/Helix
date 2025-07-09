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

export const SymbolTestGeneratorPanel: React.FC<{ file: CodeFile }> = ({ file }) => {
    const [selectedSymbolIds, setSelectedSymbolIds] = useState<Set<number>>(new Set());
    const [generatedTests, setGeneratedTests] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);

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
                <div className="p-4 border-b flex-shrink-0">
                    <h3 className="font-semibold">Generated Test Code</h3>
                    <p className="text-xs text-muted-foreground">Copy and paste this code into your test suite.</p>
                </div>
                <div className="flex-grow min-h-0">
                    <Editor
                        height="100%"
                        language="python"
                        value={finalTestCode}
                        theme="vs-dark"
                        options={{ readOnly: true, minimap: { enabled: false } }}
                    />
                </div>
            </div>
        </div>
    );
};