import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Target, TrendingDown, TrendingUp, FileText, CheckCircle, Sparkles, Eye } from "lucide-react"

interface FileStat {
    name: string
    path: string
    coverage: number
}

interface CoverageHotspotsCardProps {
    worstFiles: FileStat[]
    bestFiles: FileStat[]
}

export const CoverageHotspotsCard: React.FC<CoverageHotspotsCardProps> = ({ worstFiles, bestFiles }) => {
    const filteredWorstFiles = worstFiles.filter(file => file.coverage < 80)
    const filteredBestFiles = bestFiles.filter(file => file.coverage === 100)

    return (
        <Card className="bg-zinc-900/30 border-zinc-800/50 flex flex-col h-full max-h-full pl-6 pr-6">
            <CardHeader className="px-4 pt-4 pb-2 flex-shrink-0 mt-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-medium text-zinc-200 flex items-center">
                        <Target className="w-4 h-4 mr-2 text-zinc-400" />
                        Coverage Hotspots
                    </CardTitle>
                    <Button
                        variant="outline"
                        className="border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 bg-transparent text-xs h-6 px-2"
                    >
                        <Eye className="w-3 h-3 mr-1" />
                        View All
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 flex-grow flex flex-col min-h-0 max-h-full overflow-hidden -mt-4">
                <div className="flex-grow min-h-0 overflow-y-auto pr-1">
                    <div className="space-y-3">
                        {/* Needs Improvement */}
                        <div>
                            <div className="flex items-center mb-4">
                                <TrendingDown className="w-3.5 h-3.5 text-red-400 mr-1.5" />
                                <h3 className="text-xs font-medium text-zinc-300">Needs Immediate Attention</h3>
                            </div>
                            <div className="space-y-1.5 ">
                                {filteredWorstFiles.length > 0 ? (
                                    filteredWorstFiles.map((file) => (
                                        <div
                                            key={file.name}
                                            className="flex items-center justify-between py-2 px-3 bg-zinc-900/50 rounded-md hover:bg-zinc-800/60 cursor-pointer group"
                                        >
                                            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                                <FileText className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-medium text-white truncate">{file.name}</div>
                                                    <div className="text-xs text-zinc-500 font-mono truncate">{file.path}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2 flex-shrink-0">
                                                <Button
                                                    size="sm"
                                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-5 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Sparkles className="w-3 h-3 mr-1" />
                                                    Fix
                                                </Button>
                                                <div className="text-xs font-semibold text-red-400">{file.coverage.toFixed(1)}%</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-green-400 font-medium text-center px-3 py-6">
                                        🎉 All files are well-covered!
                                    </div>
                                )}
                            </div>
                        </div>

                        <Separator className="bg-zinc-800/50" />

                        {/* Well-Documented */}
                        <div >
                            <div className="flex items-center mt-8 mb-6">
                                <TrendingUp className="w-3.5 h-3.5 text-green-400 mr-1.5" />
                                <h3 className="text-xs font-medium text-zinc-300">Well-Documented Examples</h3>
                            </div>
                            <div className="space-y-1.5">
                                {filteredBestFiles.length > 0 ? (
                                    filteredBestFiles.map((file) => (
                                        <div
                                            key={file.name}
                                            className="flex items-center justify-between py-2 px-3 bg-zinc-900/50 rounded-md hover:bg-zinc-800/60 cursor-pointer"
                                        >
                                            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                                <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-medium text-white truncate">{file.name}</div>
                                                    <div className="text-xs text-zinc-500 font-mono truncate">{file.path}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs font-semibold text-green-400 flex-shrink-0">{file.coverage.toFixed(1)}%</div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs text-zinc-400 italic px-3">
                                        ✨ No files with 100% coverage yet. Keep going!
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
