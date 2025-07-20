import type React from "react"
import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, CheckCircle, Code2, ExternalLink, Eye, FileText, Search, Sparkles, Target, Zap } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type DocStatus = "FRESH" | "NONE" | "STALE" | "NEEDS_IMPROVEMENT"
type SymbolType = "function" | "class" | "method" | "property"

import type { ActionItem } from "../DocumentationReport"

interface DocumentationItem {
    name: any
    file_path: any
    id: string
    symbolName: string
    filePath: string
    status: DocStatus
    type: SymbolType
    documentation_status: string
}

interface ActionListCardProps {
    items: DocumentationItem[]
}

const getStatusBadge = (status: ActionItem["documentation_status"]) => {
    switch (status) {
        case "FRESH":
            return (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs px-2 py-0.5">Documented</Badge>
            )
        case "NONE":
            return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs px-2 py-0.5">Missing</Badge>
        case "STALE":
            return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs px-2 py-0.5">Stale</Badge>
        case "NEEDS_IMPROVEMENT":
            return (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs px-2 py-0.5">Needs Work</Badge>
            )
        default:
            return null
    }
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

export const ActionListCard: React.FC<ActionListCardProps> = ({ items }) => {
    const [activeTab, setActiveTab] = useState("all")
    const [searchTerm, setSearchTerm] = useState("")

    const missingDocstrings = useMemo(
        () => items.filter((item) => item.documentation_status === "MISSING").length,
        [items],
    )
    const staleDocstrings = useMemo(() => items.filter((item) => item.documentation_status === "STALE").length, [items])

    const filteredItems = useMemo(() => {
        let filtered = items
        if (activeTab === "missing") {
            filtered = filtered.filter((item) => item.documentation_status === "MISSING")
        } else if (activeTab === "stale") {
            filtered = filtered.filter((item) => item.documentation_status === "STALE")
        }
        if (searchTerm) {
            filtered = filtered.filter(
                (item) =>
                    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.file_path.toLowerCase().includes(searchTerm.toLowerCase()),
            )
        }
        return filtered
    }, [items, activeTab, searchTerm])

    return (
        <Card className="bg-zinc-900/30 border-zinc-800/50 flex flex-col h-full max-h-full pl-6 pr-6">

            <CardHeader className="px-4 pt-4 pb-2 flex-shrink-0">
                <CardTitle className="text-base font-medium text-zinc-200 flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2 text-zinc-400" />
                    Action Items
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex-grow flex flex-col min-h-0 max-h-full overflow-hidden">
                {/* Controls (fixed height) */}
                <div className="space-y-2 flex-shrink-0 mb-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-zinc-900/50 border border-zinc-800/50 p-0.5 rounded-md w-full h-8">
                            <TabsTrigger value="all" className="text-xs px-2 py-1">All ({items.length})</TabsTrigger>
                            <TabsTrigger value="missing" className="text-xs px-2 py-1">Missing ({missingDocstrings})</TabsTrigger>
                            <TabsTrigger value="stale" className="text-xs px-2 py-1">Stale ({staleDocstrings})</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                        <Input
                            placeholder="Search symbols or files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 h-7 text-xs bg-zinc-900/40 border-zinc-800 text-white placeholder-zinc-500"
                        />
                    </div>
                </div>

                {/* Scrollable content area */}
                <div className="flex-grow min-h-0 overflow-y-auto pr-1">
                    <div className="space-y-1.5">
                        {filteredItems.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-2.5 bg-zinc-900/50 rounded-md hover:bg-zinc-800/50 transition-colors group"
                            >
                                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                    {getTypeIcon(item.type)}
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-medium text-white font-mono truncate">{item.name}</div>
                                        <div className="text-xs text-zinc-500 font-mono truncate">{item.file_path}</div>
                                    </div>
                                    {getStatusBadge(item.documentation_status)}
                                </div>
                                <div className="ml-2">
                                    {item.status === "NONE" ? (
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-5 px-2">
                                            <Sparkles className="w-3 h-3 mr-1" />
                                            Generate
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-zinc-400 hover:text-zinc-200 text-xs h-5 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <ExternalLink className="w-3 h-3 mr-1" />
                                            View
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}