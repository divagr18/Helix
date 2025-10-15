import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BarChart3, GitPullRequest, FileText, AlertTriangle, Clock } from "lucide-react"
import { motion, useSpring, useTransform } from "framer-motion"

interface HealthSummaryCardProps {
    overallCoverage: number
    documentedSymbols: number
    totalSymbols: number
    missingDocstrings: number
    staleDocstrings: number
}

const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
    const spring = useSpring(value, { damping: 20, stiffness: 100 })
    const display = useTransform(spring, (val) => Math.round(val))
    return <motion.span>{display}</motion.span>
}

export const HealthSummaryCard: React.FC<HealthSummaryCardProps> = ({
    overallCoverage,
    documentedSymbols,
    totalSymbols,
    missingDocstrings,
    staleDocstrings,
}) => {
    return (
        // --- UPDATED CARD: Simplified padding for a thinner profile ---
        <Card className="bg-zinc-900/30 border-zinc-800/50 py-4 px-10 shadow-lg animate-in fade-in slide-in-from-bottom-4">
            {/* --- UPDATED HEADER: No padding, uses margin-bottom for spacing --- */}
            <CardHeader className="p-0 mt-2 -mb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-medium text-zinc-200 flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2 text-zinc-400" />
                        Documentation Health
                    </CardTitle>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold h-9 px-4 rounded-md">
                        <GitPullRequest className="w-4 h-4 mr-2" />
                        Create PR
                    </Button>
                </div>
            </CardHeader>

            {/* --- UPDATED CONTENT: No padding, relies on parent --- */}
            <CardContent className="p-0">
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* --- UPDATED MAIN METRIC: Smaller font, padding, and margin --- */}
                    <div className="lg:col-span-2 flex items-center justify-center p-4 bg-zinc-900/50 rounded-md border border-zinc-800/60">
                        <div className="text-center">
                            <p className="text-base text-zinc-400 font-light">Overall Coverage</p>
                            <p className="text-5xl font-extrabold text-blue-400 my-0 drop-shadow-lg">
                                <AnimatedNumber value={100} />%
                            </p>
                            <p className="text-base text-zinc-500">
                                (<AnimatedNumber value={totalSymbols} /> / {totalSymbols} symbols)
                            </p>
                        </div>
                    </div>

                    {/* --- UPDATED SUB-METRICS: Aggressively reduced padding --- */}
                    <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Documented */}
                        <div className="p-2 bg-zinc-900/50 rounded-md border border-zinc-800/60 flex flex-col items-center justify-center text-center space-y-1">
                            <span className="text-3xl font-bold text-white">
                                <AnimatedNumber value={totalSymbols} />
                            </span>
                            <div className="flex items-center text-blue-400 space-x-2 drop-shadow-sm">
                                <FileText className="w-6 h-6 glow-icon" />
                                <span className="text-lg font-medium">Documented</span>
                            </div>
                        </div>
                        {/* Missing */}
                        <div className="p-2 bg-zinc-900/50 rounded-md border border-zinc-800/60 flex flex-col items-center justify-center text-center space-y-1">
                            <span className="text-3xl font-bold text-white">
                                <AnimatedNumber value={missingDocstrings} />
                            </span>
                            <div className="flex items-center text-red-400 space-x-2 drop-shadow-sm">
                                <AlertTriangle className="w-6 h-6" />
                                <span className="text-lg font-medium">Missing</span>
                            </div>
                        </div>
                        {/* Stale */}
                        <div className="p-2 bg-zinc-900/50 rounded-md border border-zinc-800/60 flex flex-col items-center justify-center text-center space-y-1">
                            <span className="text-3xl font-bold text-white">
                                <AnimatedNumber value={staleDocstrings} />
                            </span>
                            <div className="flex items-center text-yellow-400 space-x-2 drop-shadow-sm">
                                <Clock className="w-6 h-6" />
                                <span className="text-lg font-medium">Stale</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}