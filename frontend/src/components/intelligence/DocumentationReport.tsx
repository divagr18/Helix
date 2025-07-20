import { useState, useEffect } from "react"
import axios from "axios"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { Skeleton } from "@/components/ui/skeleton"

// Import the styled child components
import { HealthSummaryCard } from "./docs/HealthSummaryCard"
import { CoverageHotspotsCard } from "./docs/CoverageHotspotsCard"
import { ActionListCard } from "./docs/ActionListCard"

// --- DEFINE TYPES TO MATCH OUR BACKEND API RESPONSE ---
export interface ActionItem {
    id: string
    name: string
    file_path: string
    documentation_status: "FRESH" | "NONE" | "STALE" | "NEEDS_IMPROVEMENT"
    type: "function" | "class" | "method" | "property"
    cyclomatic_complexity: number
}

interface FileStat {
    name: string
    path: string
    coverage: number
}

interface Hotspots {
    needs_improvement: FileStat[]
    well_documented: FileStat[]
}

interface SummaryStats {
    overallCoverage: number
    documentedSymbols: number
    totalSymbols: number
    staleDocs: number
    missingDocs: number
}

export const DocumentationReport = () => {
    const { activeRepository } = useWorkspaceStore()
    const [summary, setSummary] = useState<SummaryStats | null>(null)
    const [hotspots, setHotspots] = useState<Hotspots | null>(null)
    const [actionItems, setActionItems] = useState<ActionItem[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (activeRepository) {
            setIsLoading(true)
            axios
                .get(`/api/v1/repositories/${activeRepository.id}/documentation/summary/`)
                .then((response) => {
                    setSummary(response.data.summary_stats)
                    setHotspots(response.data.hotspots)
                    setActionItems(response.data.action_items)
                })
                .catch((err) => console.error("Failed to fetch documentation summary", err))
                .finally(() => setIsLoading(false))
        } else {
            setIsLoading(false) // No repo selected, so not loading
        }
    }, [activeRepository])

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-[180px] w-full bg-zinc-900/30" />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <Skeleton className="h-[400px] w-full bg-zinc-900/30" />
                    <Skeleton className="h-[400px] w-full bg-zinc-900/30" />
                </div>
            </div>
        )
    }

    if (!activeRepository || !summary || !hotspots) {
        return <p className="text-center text-zinc-500">Select a repository to view its documentation health.</p>
    }

    return (
        <div className="h-full flex flex-col space-y-6 overflow-hidden">
            {/* Fixed height summary card */}
            <div className="flex-shrink-0">
                <HealthSummaryCard
                    overallCoverage={summary.overallCoverage}
                    documentedSymbols={summary.documentedSymbols}
                    totalSymbols={summary.totalSymbols}
                    missingDocstrings={summary.missingDocs}
                    staleDocstrings={summary.staleDocs}
                />
            </div>

            {/* Grid that takes remaining space with max height constraint */}
            <div className="flex-grow grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-0">
                <div className="min-h-0">
                    <CoverageHotspotsCard worstFiles={hotspots.needs_improvement} bestFiles={hotspots.well_documented} />
                </div>
                <div className="min-h-0">
                    <ActionListCard items={actionItems} />
                </div>
            </div>
        </div>
    )
}