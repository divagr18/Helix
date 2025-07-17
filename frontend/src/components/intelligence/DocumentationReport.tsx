"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
    BarChart3,
    GitPullRequest,
    FileText,
    AlertTriangle,
    Clock,
    Target,
    TrendingDown,
    TrendingUp,
    CheckCircle,
    Code2,
    Zap,
    Eye,
    Sparkles,
    ExternalLink,
    Search,
    Download,
    Settings,
} from "lucide-react"

// Types
type DocStatus = "documented" | "missing" | "stale" | "needs_improvement"
type SymbolType = "function" | "class" | "method" | "property"

interface DocumentationItem {
    id: string
    symbolName: string
    filePath: string
    status: DocStatus
    type: SymbolType
    codeLastModified: string
    docLastModified: string | null
    qualityScore: number
    complexity: number
    isPublic: boolean
}

interface FileStats {
    name: string
    path: string
    coverage: number
    totalSymbols: number
    documentedSymbols: number
}

// Mock data
const documentationItems: DocumentationItem[] = [
    {
        id: "1",
        symbolName: "fetch_stock_data",
        filePath: "src/data/market_data.py",
        status: "documented",
        codeLastModified: "2024-01-15",
        docLastModified: "2024-01-10",
        qualityScore: 4.2,
        complexity: 8,
        isPublic: true,
        type: "function",
    },
    {
        id: "2",
        symbolName: "validate_user_input",
        filePath: "src/utils/validation.py",
        status: "missing",
        codeLastModified: "2024-01-14",
        docLastModified: null,
        qualityScore: 0,
        complexity: 3,
        isPublic: true,
        type: "function",
    },
    {
        id: "3",
        symbolName: "DatabaseConnection",
        filePath: "src/database/connection.py",
        status: "stale",
        codeLastModified: "2024-01-12",
        docLastModified: "2023-12-20",
        qualityScore: 3.1,
        complexity: 5,
        isPublic: true,
        type: "class",
    },
    {
        id: "4",
        symbolName: "process_payment",
        filePath: "src/services/billing.py",
        status: "needs_improvement",
        codeLastModified: "2024-01-13",
        docLastModified: "2024-01-13",
        qualityScore: 2.3,
        complexity: 6,
        isPublic: true,
        type: "function",
    },
    {
        id: "5",
        symbolName: "UserProfile",
        filePath: "src/models/user.py",
        status: "documented",
        codeLastModified: "2024-01-11",
        docLastModified: "2024-01-11",
        qualityScore: 4.8,
        complexity: 4,
        isPublic: true,
        type: "class",
    },
    {
        id: "6",
        symbolName: "calculate_metrics",
        filePath: "src/analytics/metrics.py",
        status: "missing",
        codeLastModified: "2024-01-16",
        docLastModified: null,
        qualityScore: 0,
        complexity: 7,
        isPublic: true,
        type: "function",
    },
    {
        id: "7",
        symbolName: "send_notification",
        filePath: "src/services/notifications.py",
        status: "missing",
        codeLastModified: "2024-01-17",
        docLastModified: null,
        qualityScore: 0,
        complexity: 4,
        isPublic: true,
        type: "function",
    },
    {
        id: "8",
        symbolName: "parse_config",
        filePath: "src/config/parser.py",
        status: "missing",
        codeLastModified: "2024-01-18",
        docLastModified: null,
        qualityScore: 0,
        complexity: 2,
        isPublic: true,
        type: "function",
    },
]

const fileStats: FileStats[] = [
    {
        name: "market_data.py",
        path: "src/data/market_data.py",
        coverage: 85.2,
        totalSymbols: 12,
        documentedSymbols: 10,
    },
    { name: "user.py", path: "src/models/user.py", coverage: 92.3, totalSymbols: 8, documentedSymbols: 7 },
    { name: "validation.py", path: "src/utils/validation.py", coverage: 15.4, totalSymbols: 13, documentedSymbols: 2 },
    { name: "billing.py", path: "src/services/billing.py", coverage: 23.1, totalSymbols: 15, documentedSymbols: 3 },
    {
        name: "connection.py",
        path: "src/database/connection.py",
        coverage: 67.8,
        totalSymbols: 9,
        documentedSymbols: 6,
    },
    {
        name: "notifications.py",
        path: "src/services/notifications.py",
        coverage: 12.5,
        totalSymbols: 8,
        documentedSymbols: 1,
    },
]

// Helper functions
const getStatusBadge = (status: DocStatus) => {
    switch (status) {
        case "documented":
            return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Documented</Badge>
        case "missing":
            return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">Missing</Badge>
        case "stale":
            return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Stale</Badge>
        case "needs_improvement":
            return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">Needs Work</Badge>
        default:
            return null
    }
}

const getTypeIcon = (type: SymbolType) => {
    switch (type) {
        case "function":
            return <Code2 className="w-3 h-3 text-blue-400" />
        case "class":
            return <Target className="w-3 h-3 text-purple-400" />
        case "method":
            return <Zap className="w-3 h-3 text-green-400" />
        case "property":
            return <Eye className="w-3 h-3 text-cyan-400" />
        default:
            return <FileText className="w-3 h-3 text-zinc-400" />
    }
}

export default function DocumentationHealthDashboard() {
    const [activeTab, setActiveTab] = useState("all")
    const [searchTerm, setSearchTerm] = useState("")

    // Calculate stats
    const totalSymbols = documentationItems.length
    const documentedSymbols = documentationItems.filter((item) => item.status === "documented").length
    const staleDocstrings = documentationItems.filter((item) => item.status === "stale").length
    const missingDocstrings = documentationItems.filter((item) => item.status === "missing").length
    const overallCoverage = (documentedSymbols / totalSymbols) * 100

    const worstFiles = fileStats.sort((a, b) => a.coverage - b.coverage).slice(0, 3)
    const bestFiles = fileStats.sort((a, b) => b.coverage - a.coverage).slice(0, 3)

    // Filter items
    const filteredItems = useMemo(() => {
        let filtered = documentationItems
        if (activeTab !== "all") {
            filtered = filtered.filter((item) => item.status === activeTab)
        }
        if (searchTerm) {
            filtered = filtered.filter(
                (item) =>
                    item.symbolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.filePath.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        }
        return filtered
    }, [activeTab, searchTerm])

    const tabCounts = {
        all: documentationItems.length,
        missing: missingDocstrings,
        stale: staleDocstrings,
        documented: documentedSymbols,
    }

    return (
        <div className="h-screen bg-zinc-950 text-white flex flex-col">
            {/* Header */}
            <div className="border-b border-zinc-800/50 bg-zinc-900/20 flex-shrink-0">
                {/* --- Apply padding directly here --- */}
                <div className="w-full px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-white">Documentation Health</h1>
                            <p className="text-sm text-zinc-400 mt-1">Monitor and improve your codebase documentation coverage</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 bg-transparent">
                                <Download className="w-4 h-4 mr-2" />
                                Export Report
                            </Button>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Sparkles className="w-4 h-4 mr-2" />
                                Generate All Missing
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            <ScrollArea className="flex-1">
                <div className="w-full px-6 py-8 space-y-8">
                    {/* Health Summary Card - Full Width */}
                    <Card className="bg-zinc-900/30 border-zinc-800/50">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-semibold text-white flex items-center">
                                    <BarChart3 className="w-5 h-5 mr-3 text-zinc-400" />
                                    Documentation Health Summary
                                </CardTitle>
                                <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                                    <GitPullRequest className="w-4 h-4 mr-2" />
                                    Create PR
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                                {/* Main Coverage Metric */}
                                <div className="lg:col-span-1 flex items-center justify-center p-6 bg-zinc-900/50 rounded-xl border border-zinc-800/60">
                                    <div className="text-center">
                                        <p className="text-sm text-zinc-400 mb-2">Overall Coverage</p>
                                        <p className="text-4xl font-bold text-blue-400 mb-2">{overallCoverage.toFixed(1)}%</p>
                                        <Button variant="ghost" className="text-xs text-zinc-500 hover:text-zinc-300 h-auto p-1">
                                            View Details
                                        </Button>
                                    </div>
                                </div>

                                {/* Sub-metrics */}
                                <div className="lg:col-span-3 grid grid-cols-3 gap-4">
                                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/60 text-center">
                                        <div className="flex items-center justify-center text-green-400 mb-2">
                                            <FileText className="w-4 h-4 mr-2" />
                                            <span className="text-sm">Documented</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white mb-2">{documentedSymbols}</p>
                                        <Button size="sm" variant="ghost" className="text-xs text-zinc-500 hover:text-zinc-300 h-6">
                                            Add More
                                        </Button>
                                    </div>

                                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/60 text-center">
                                        <div className="flex items-center justify-center text-red-400 mb-2">
                                            <AlertTriangle className="w-4 h-4 mr-2" />
                                            <span className="text-sm">Missing</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white mb-2">{missingDocstrings}</p>
                                        <Button
                                            size="sm"
                                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/30 text-xs h-6"
                                        >
                                            Fix Now
                                        </Button>
                                    </div>

                                    <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/60 text-center">
                                        <div className="flex items-center justify-center text-yellow-400 mb-2">
                                            <Clock className="w-4 h-4 mr-2" />
                                            <span className="text-sm">Stale</span>
                                        </div>
                                        <p className="text-2xl font-bold text-white mb-2">{staleDocstrings}</p>
                                        <Button
                                            size="sm"
                                            className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 border-yellow-500/30 text-xs h-6"
                                        >
                                            Review
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Two Column Layout */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-stretch">
                        {/* Coverage Hotspots */}
                        <Card className="bg-zinc-900/30 border-zinc-800/50 flex flex-col">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-semibold text-white flex items-center">
                                        <Target className="w-5 h-5 mr-3 text-zinc-400" />
                                        Coverage Hotspots
                                    </CardTitle>
                                    <Button
                                        variant="outline"
                                        className="border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 text-sm bg-transparent"
                                    >
                                        <Eye className="w-4 h-4 mr-2" />
                                        View All
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {/* Needs Attention */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center">
                                            <TrendingDown className="w-4 h-4 text-red-400 mr-2" />
                                            <h3 className="text-sm font-medium text-white">Needs Attention</h3>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 border-red-500/30 text-xs"
                                        >
                                            Fix All
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {worstFiles.map((file) => (
                                            <div
                                                key={file.name}
                                                className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                                            >
                                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                    <FileText className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium text-white truncate">{file.name}</div>
                                                        <div className="text-xs text-zinc-500 font-mono truncate">{file.path}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <div className="text-sm font-semibold text-red-400">{file.coverage.toFixed(1)}%</div>
                                                    <Button
                                                        size="sm"
                                                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Sparkles className="w-3 h-3 mr-1" />
                                                        Fix
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <Separator className="bg-zinc-800/50" />

                                {/* Well Documented */}
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center">
                                            <TrendingUp className="w-4 h-4 text-green-400 mr-2" />
                                            <h3 className="text-sm font-medium text-white">Well Documented</h3>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="bg-green-600/20 hover:bg-green-600/30 text-green-400 border-green-500/30 text-xs"
                                        >
                                            Use as Template
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {bestFiles.map((file) => (
                                            <div
                                                key={file.name}
                                                className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg hover:bg-zinc-800/50 transition-colors"
                                            >
                                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium text-white truncate">{file.name}</div>
                                                        <div className="text-xs text-zinc-500 font-mono truncate">{file.path}</div>
                                                    </div>
                                                </div>
                                                <div className="text-sm font-semibold text-green-400">{file.coverage.toFixed(1)}%</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Action Items */}
                        <Card className="bg-zinc-900/30 border-zinc-800/50">
                            <CardHeader className="pb-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-semibold text-white flex items-center">
                                        <CheckCircle className="w-5 h-5 mr-3 text-zinc-400" />
                                        Action Items
                                    </CardTitle>
                                    <Button
                                        variant="outline"
                                        className="border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 text-sm bg-transparent"
                                    >
                                        <Settings className="w-4 h-4 mr-2" />
                                        Bulk Actions
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Controls */}
                                <div className="space-y-3">
                                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                                        <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-1 rounded-lg w-full">
                                            <TabsTrigger
                                                value="all"
                                                className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400 text-sm flex-1"
                                            >
                                                All ({tabCounts.all})
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="missing"
                                                className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400 text-sm flex-1"
                                            >
                                                Missing ({tabCounts.missing})
                                            </TabsTrigger>
                                            <TabsTrigger
                                                value="stale"
                                                className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400 text-sm flex-1"
                                            >
                                                Stale ({tabCounts.stale})
                                            </TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                            <Input
                                                placeholder="Search symbols or files..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="pl-9 bg-zinc-900/50 border-zinc-800/50 text-white placeholder-zinc-500"
                                            />
                                        </div>
                                        {activeTab === "missing" && (
                                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                                                <Sparkles className="w-4 h-4 mr-2" />
                                                Generate All
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Items List */}
                                <ScrollArea className="flex-grow pr-2">
                                    <div className="space-y-2 pr-2">
                                        {filteredItems.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                                            >
                                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                                    {getTypeIcon(item.type)}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium text-white font-mono truncate">{item.symbolName}</div>
                                                        <div className="text-xs text-zinc-500 font-mono truncate">{item.filePath}</div>
                                                    </div>
                                                    {getStatusBadge(item.status)}
                                                </div>
                                                <div className="ml-3">
                                                    {item.status === "missing" ? (
                                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
                                                            <Sparkles className="w-3 h-3 mr-1" />
                                                            Generate
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-zinc-400 hover:text-zinc-200 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <ExternalLink className="w-3 h-3 mr-1" />
                                                            View
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </ScrollArea>
        </div>
    )
}
