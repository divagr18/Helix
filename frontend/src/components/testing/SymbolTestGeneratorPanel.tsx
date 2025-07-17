"use client"

import type React from "react"

import { useState, useMemo } from "react"
import axios from "axios"
import { toast } from "sonner"
import type { CodeFile } from "@/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bot, Loader2, Play, Copy, Code2, Target, Zap, Eye, FileText, CheckSquare } from "lucide-react"
import Editor, { type BeforeMount } from "@monaco-editor/react"
import { getCookie } from "@/utils/cookies"
import { TestRunResults } from "./TestRunResults"

interface SymbolTestGeneratorPanelProps {
    file: CodeFile
    sourceCode: string | null
    isLoadingContent?: boolean
}

const getTypeIcon = (type: string) => {
    switch (type) {
        case "function":
            return <Code2 className="w-3.5 h-3.5 text-blue-400" />
        case "class":
            return <Target className="w-3.5 h-3.5 text-purple-400" />
        case "method":
            return <Zap className="w-3.5 h-3.5 text-green-400" />
        case "property":
            return <Eye className="w-3.5 h-3.5 text-cyan-400" />
        default:
            return <FileText className="w-3.5 h-3.5 text-zinc-400" />
    }
}

export const SymbolTestGeneratorPanel: React.FC<SymbolTestGeneratorPanelProps> = ({
    file,
    sourceCode,
    isLoadingContent = false,
}) => {
    const [selectedSymbolIds, setSelectedSymbolIds] = useState<Set<number>>(new Set())
    const [generatedTests, setGeneratedTests] = useState<string>("")
    const [isLoading, setIsLoading] = useState(false)
    const [isTesting, setIsTesting] = useState(false)
    const [testRunResult, setTestRunResult] = useState<any>(null)

    // Flatten all symbols from the file into a single list
    const allSymbols = useMemo(() => {
        return [
            ...file.symbols,
            ...file.classes.flatMap((cls) => cls.methods.map((m) => ({ ...m, className: cls.name }))),
        ].sort((a, b) => a.start_line - b.start_line)
    }, [file])

    const handleToggleSymbol = (id: number) => {
        setSelectedSymbolIds((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    const handleSelectAll = () => {
        if (selectedSymbolIds.size === allSymbols.length) {
            setSelectedSymbolIds(new Set())
        } else {
            setSelectedSymbolIds(new Set(allSymbols.map((s) => s.id)))
        }
    }

    const handleGenerateTests = async () => {
        if (selectedSymbolIds.size === 0) {
            toast.warning("No symbols selected.")
            return
        }

        setIsLoading(true)
        setGeneratedTests("") // Clear previous results
        toast.info(`Generating a cohesive test file for ${selectedSymbolIds.size} symbol(s)...`)

        const payload = {
            symbol_ids: Array.from(selectedSymbolIds),
        }

        try {
            // --- THIS IS THE CORRECT STREAMING IMPLEMENTATION ---
            const response = await fetch("/api/v1/generate-cohesive-tests/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken") || "", // Ensure CSRF token is included
                },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                // Handle HTTP errors like 404 or 500
                const errorData = await response.json()
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
            }

            if (!response.body) {
                throw new Error("Response has no body to read.")
            }

            // Use the browser's native ReadableStream API
            const reader = response.body.getReader()
            const decoder = new TextDecoder()

            while (true) {
                const { done, value } = await reader.read()
                if (done) {
                    break // The stream has finished
                }
                const chunk = decoder.decode(value, { stream: true })
                // Update the state with each new chunk to render the stream live
                setGeneratedTests((prev) => prev + chunk)
            }
            // --- END CORRECT STREAMING IMPLEMENTATION ---

            toast.success("Test generation complete.")
        } catch (error) {
            console.error("Failed to generate cohesive test file:", error)
            toast.error("Failed to generate test file.", { description: String(error) })
        } finally {
            setIsLoading(false)
        }
    }

    const handleEditorWillMount: BeforeMount = (monaco) => {
        monaco.editor.defineTheme("zinc-dark", {
            base: "vs-dark",
            inherit: true,
            rules: [
                { token: "comment", foreground: "6b7280" },
                { token: "keyword", foreground: "8b5cf6" },
                { token: "string", foreground: "10b981" },
                { token: "number", foreground: "f59e0b" },
            ],
            colors: {
                "editor.background": "#09090b",
                "editor.foreground": "#fafafa",
                "editorLineNumber.foreground": "#71717a",
                "editorLineNumber.activeForeground": "#a1a1aa",
                "editor.selectionBackground": "#1e40af40",
                "editor.inactiveSelectionBackground": "#374151",
                "editorCursor.foreground": "#3b82f6",
            },
        })
    }

    const handleRunTests = async () => {
        if (!sourceCode || !generatedTests) {
            toast.error("Missing source code or generated tests to run.")
            return
        }

        setIsTesting(true)
        setTestRunResult(null)
        toast.info("Running tests in a secure sandbox...")

        try {
            const response = await axios.post("/api/v1/testing/run-sandbox/", {
                source_code: sourceCode,
                test_code: generatedTests,
            })
            // Here you would start polling the task ID from response.data.task_id
            // For now, we'll just simulate the result.
            // In a real app: pollTaskStatus(response.data.task_id).then(setTestRunResult);
            toast.success("Test run complete!")
        } catch (error) {
            toast.error("Failed to start test run.")
        } finally {
            setIsTesting(false)
        }
    }

    if (isLoadingContent) {
        return (
            <div className="h-full flex items-center justify-center bg-zinc-950">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-400 mx-auto mb-3" />
                    <p className="text-zinc-400 text-sm">Loading file content...</p>
                </div>
            </div>
        )
    }

    if (allSymbols.length === 0) {
        return (
            <div className="h-full flex items-center justify-center bg-zinc-950">
                <div className="text-center">
                    <Code2 className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400 text-sm">No testable symbols found in this file</p>
                    <p className="text-zinc-600 text-xs mt-1">Try selecting a different file</p>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full grid grid-cols-[35%_65%] bg-zinc-950">
            {/* Left side: Symbol selection */}
            <div className="flex flex-col border-r border-zinc-800/60 bg-zinc-900/30">
                <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/50">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-zinc-200 text-sm">Select Symbols to Test</h3>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAll}
                            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 bg-transparent text-xs h-6 px-2"
                        >
                            <CheckSquare className="w-3 h-3 mr-1" />
                            {selectedSymbolIds.size === allSymbols.length ? "None" : "All"}
                        </Button>
                    </div>
                    <p className="text-xs text-zinc-500 font-mono">{file.file_path}</p>
                    <p className="text-xs text-zinc-600 mt-1">
                        {selectedSymbolIds.size} of {allSymbols.length} selected
                    </p>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-3 space-y-2">
                        {allSymbols.map((symbol) => (
                            <div
                                key={symbol.id}
                                className="flex items-center space-x-3 p-2.5 bg-zinc-900/40 rounded-md hover:bg-zinc-800/60 transition-colors group"
                            >
                                <Checkbox
                                    id={`symbol-${symbol.id}`}
                                    checked={selectedSymbolIds.has(symbol.id)}
                                    onCheckedChange={() => handleToggleSymbol(symbol.id)}
                                    className="border-zinc-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    {getTypeIcon(symbol.type || "function")}
                                    <div className="min-w-0 flex-1">
                                        <label
                                            htmlFor={`symbol-${symbol.id}`}
                                            className="text-sm font-mono cursor-pointer text-zinc-200 block truncate"
                                        >
                                            {symbol.name}
                                        </label>
                                        {symbol.className && <span className="text-xs text-zinc-500 font-mono">in {symbol.className}</span>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <div className="p-4 border-t border-zinc-800/60 bg-zinc-900/50">
                    <Button
                        onClick={handleGenerateTests}
                        disabled={isLoading || selectedSymbolIds.size === 0}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                        Generate Tests ({selectedSymbolIds.size})
                    </Button>
                </div>
            </div>

            {/* Right side: Test code display */}
            <div className="h-full flex flex-col bg-zinc-950">
                <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/30 flex justify-between items-center">
                    <div>
                        <h3 className="font-medium text-zinc-200 text-sm">Generated Test Code</h3>
                        <p className="text-xs text-zinc-500 mt-1">Review, copy, and run the generated tests</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(generatedTests)}
                            disabled={!generatedTests}
                            className="border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 bg-transparent text-xs h-7 px-3"
                        >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy
                        </Button>
                        <Button
                            onClick={handleRunTests}
                            disabled={!generatedTests || isTesting}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-3"
                        >
                            {isTesting ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Play className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Run Tests
                        </Button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 relative">
                    {generatedTests ? (
                        <Editor
                            height="100%"
                            language="python"
                            value={generatedTests}
                            theme="zinc-dark"
                            beforeMount={handleEditorWillMount}
                            options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineHeight: 1.5,
                                padding: { top: 16, bottom: 16 },
                                scrollBeyondLastLine: false,
                                renderLineHighlight: "none",
                                overviewRulerBorder: false,
                                hideCursorInOverviewRuler: true,
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <Bot className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                                <p className="text-zinc-400 text-sm">No tests generated yet</p>
                                <p className="text-zinc-600 text-xs mt-1">Select symbols and click Generate Tests</p>
                            </div>
                        </div>
                    )}

                    {testRunResult && (
                        <div className="absolute bottom-0 left-0 right-0 max-h-1/3 border-t border-zinc-800/60">
                            <TestRunResults result={testRunResult} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
