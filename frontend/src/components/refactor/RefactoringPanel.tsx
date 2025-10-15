"use client"

import type React from "react"
// --- NEW: Import useEffect and useRef ---
import { useState, useEffect, useRef } from "react"
import type { CodeSymbol } from "@/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Bot, RefreshCw, Wand2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { cn } from "@/lib/utils"

interface RefactoringPanelProps {
    symbol: CodeSymbol
}

export const RefactoringPanel: React.FC<RefactoringPanelProps> = ({ symbol }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false)
    const [analysisResult, setAnalysisResult] = useState<string>("")
    // --- NEW: Create a ref for the scrollable content area ---
    const contentRef = useRef<HTMLDivElement | null>(null)

    // --- NEW: Add an effect to auto-scroll when content changes ---
    useEffect(() => {
        if (contentRef.current) {
            // Use smooth behavior for a better user experience
            contentRef.current.scrollTo({
                top: contentRef.current.scrollHeight,
                behavior: 'smooth',
            });
        }
    }, [analysisResult]) // This effect runs every time analysisResult is updated

    const handleAnalyze = async () => {
        setIsAnalyzing(true)
        setAnalysisResult("")
        try {
            const response = await fetch(`/api/v1/symbols/${symbol.id}/suggest-refactors/`)
            if (!response.body) throw new Error("Response has no body")
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value, { stream: true })
                setAnalysisResult((prev) => prev + chunk)
            }
        } catch (error) {
            setAnalysisResult("Error: Could not fetch refactoring suggestions.")
        } finally {
            setIsAnalyzing(false)
        }
    }

    return (
        <Card className="bg-zinc-900/20 border-zinc-900/50">
            <CardHeader className="pb-3 px-4 pt-4">
                <div className="flex items-center justify-between -mt-4 pl-4 pr-4">
                    <CardTitle className="text-base font-medium text-white flex items-center">
                        <Bot className="w-4 h-4 mr-2 mb-0.5 text-purple-400" />
                        Helix Refactoring Analysis
                    </CardTitle>
                    <Button
                        className="bg-orange-500 hover:bg-orange-600 text-black text-xs h-7 px-3"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                    >
                        {isAnalyzing ? <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1.5" />}
                        {analysisResult ? "Re-analyze" : "Analyze with Helix"}
                    </Button>
                </div>
            </CardHeader>
            {/* --- UPDATED: Added ref and CSS classes for scrolling --- */}
            <CardContent
                ref={contentRef}
                className="px-4 pb-4 -mt-8 max-h-[500px] overflow-y-auto pl-4"
            >
                {analysisResult ? (
                    <div className="prose prose-invert prose-sm max-w-none pl-6 pr-6 -mt-2">
                        <ReactMarkdown
                            components={{
                                h1: ({ node, ...props }) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                                h2: ({ node, ...props }) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-white mt-4 mb-2" {...props} />,
                                ul: ({ node, children, ...props }) => (
                                    <ul className="list-disc list-outside pl-5" {...props}>
                                        {children}
                                    </ul>
                                ),
                                li: ({ node, children, ...props }) => (
                                    <li className="mb-4 text-sm text-zinc-200 leading-relaxed" {...props}>
                                        {children}
                                    </li>
                                ),
                                p: ({ node, ...props }) => <p className="text-sm text-zinc-200 mb-2 leading-relaxed" {...props} />,
                                strong: ({ node, children, ...props }) => {
                                    if (typeof children === "string" && children.includes("Reasoning:")) {
                                        return (
                                            <strong className="font-bold text-white" {...props}>
                                                {children}
                                            </strong>
                                        )
                                    }
                                    return (
                                        <strong className="font-semibold text-white" {...props}>
                                            {children}
                                        </strong>
                                    )
                                },
                                code({ node, inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || "")
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            style={vscDarkPlus}
                                            language={match[1]}
                                            PreTag="div"
                                            {...props}
                                            className="rounded-md !bg-[#080808] p-4 text-sm overflow-auto"
                                        >
                                            {String(children).replace(/\n$/, "")}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={cn(className, "bg-zinc-700 text-zinc-100 px-1 py-0.5 rounded")} {...props}>
                                            {children}
                                        </code>
                                    )
                                },
                            }}
                        >
                            {analysisResult}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <p className="text-sm text-zinc-500">
                            Click "Analyze with Helix" to generate refactoring suggestions for this function.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}