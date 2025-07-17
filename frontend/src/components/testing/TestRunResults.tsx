"use client"

import type React from "react"

import { CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface TestResult {
    name: string
    status: "passed" | "failed" | "skipped" | "error"
    duration: number
    message?: string
}

interface TestRunResultsProps {
    result: {
        status: "success" | "failure" | "error"
        total_tests: number
        passed: number
        failed: number
        skipped: number
        duration: number
        tests: TestResult[]
        error_message?: string
    }
}

const getStatusIcon = (status: string) => {
    switch (status) {
        case "passed":
            return <CheckCircle className="w-4 h-4 text-green-400" />
        case "failed":
            return <XCircle className="w-4 h-4 text-red-400" />
        case "skipped":
            return <AlertCircle className="w-4 h-4 text-yellow-400" />
        case "error":
            return <XCircle className="w-4 h-4 text-red-400" />
        default:
            return <Clock className="w-4 h-4 text-zinc-400" />
    }
}

const getStatusBadge = (status: string) => {
    switch (status) {
        case "passed":
            return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Passed</Badge>
        case "failed":
            return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Failed</Badge>
        case "skipped":
            return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Skipped</Badge>
        case "error":
            return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Error</Badge>
        default:
            return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30 text-xs">Unknown</Badge>
    }
}

export const TestRunResults: React.FC<TestRunResultsProps> = ({ result }) => {
    return (
        <div className="h-full bg-zinc-900/50 border-t border-zinc-800/60">
            <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/70">
                <div className="flex items-center justify-between">
                    <h3 className="font-medium text-zinc-200 text-sm flex items-center">
                        {result.status === "success" ? (
                            <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                        ) : (
                            <XCircle className="w-4 h-4 mr-2 text-red-400" />
                        )}
                        Test Results
                    </h3>
                    <div className="flex items-center space-x-3 text-xs">
                        <span className="text-zinc-400">
                            {result.total_tests} tests in {result.duration.toFixed(2)}s
                        </span>
                    </div>
                </div>

                <div className="flex items-center space-x-4 mt-2 text-xs">
                    <span className="text-green-400">{result.passed} passed</span>
                    <span className="text-red-400">{result.failed} failed</span>
                    <span className="text-yellow-400">{result.skipped} skipped</span>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                    {result.error_message && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                            <p className="text-red-400 text-sm font-medium mb-1">Execution Error</p>
                            <p className="text-red-300 text-xs font-mono">{result.error_message}</p>
                        </div>
                    )}

                    {result.tests.map((test, index) => (
                        <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-zinc-800/40 rounded-md hover:bg-zinc-800/60 transition-colors"
                        >
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                                {getStatusIcon(test.status)}
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-zinc-200 font-mono truncate">{test.name}</div>
                                    {test.message && <div className="text-xs text-zinc-500 mt-1 font-mono">{test.message}</div>}
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <span className="text-xs text-zinc-500">{test.duration.toFixed(3)}s</span>
                                {getStatusBadge(test.status)}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    )
}
