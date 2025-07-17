// src/components/intelligence/docs/ActionListCard.tsx
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table'; // Assuming you have this generic component
import { columns, type DocStatus } from './action-list-columns'; // We'll define these next
import { Badge, CheckCircle, Code2, ExternalLink, Eye, FileText, Search, Sparkles, Target, Zap } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { Button } from '@/components/ui/button';
type DocStatus = "documented" | "missing" | "stale" | "needs_improvement";
type SymbolType = "function" | "class" | "method" | "property";
interface DocumentationItem {
    id: string;
    symbolName: string;
    filePath: string;
    status: DocStatus;
    type: SymbolType;
}

interface ActionListCardProps {
    items: DocumentationItem[];
}
const getStatusBadge = (status: string) => {
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

const getTypeIcon = (type: string) => {
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

export const ActionListCard: React.FC<ActionListCardProps> = ({ items }) => {
    const [activeTab, setActiveTab] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    const filteredItems = useMemo(() => {
        let filtered = items;
        if (activeTab !== "all") {
            filtered = filtered.filter((item) => item.status === activeTab);
        }
        if (searchTerm) {
            filtered = filtered.filter(
                (item) =>
                    item.symbolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.filePath.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return filtered;
    }, [items, activeTab, searchTerm]);

    return (
        <Card className="bg-zinc-900/30 border-zinc-800/50">
            <CardHeader className="px-5 pt-5 pb-3">
                <CardTitle className="text-lg font-semibold text-white flex items-center">
                    <CheckCircle className="w-5 h-5 mr-3 text-zinc-400" />
                    Action Items
                </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-6 space-y-4">
                {/* Controls */}
                <div className="space-y-3">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-zinc-900/40 border border-zinc-800 p-0.5 rounded-md w-full">
                            <TabsTrigger value="all" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400 text-xs px-3 py-1.5 rounded-sm flex-1">All</TabsTrigger>
                            <TabsTrigger value="missing" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400 text-xs px-3 py-1.5 rounded-sm flex-1">Missing</TabsTrigger>
                            <TabsTrigger value="stale" className="data-[state=active]:bg-zinc-700 data-[state=active]:text-white text-zinc-400 text-xs px-3 py-1.5 rounded-sm flex-1">Stale</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                            placeholder="Search symbols or files..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-8 text-sm bg-zinc-900/40 border-zinc-800 text-white placeholder-zinc-500"
                        />
                    </div>
                </div>
                {/* Items List */}
                <ScrollArea className="h-96">
                    <div className="space-y-2 pr-2">
                        {filteredItems.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-800/40 rounded-lg hover:bg-zinc-800/60 transition-colors group">
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
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-6 px-2">
                                            <Sparkles className="w-3 h-3 mr-1" />
                                            Generate
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200 text-xs h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
    );
};