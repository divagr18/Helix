import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { CoverageDashboard } from "@/components/testing/CoverageDashboard"
import { TestGenerationDashboard } from "@/components/testing/TestGenerationDashboard"
import { Play, Download, Settings, RefreshCw } from "lucide-react"
import type { CodeFile } from "@/types"
import type { TreeNode } from "@/utils/tree"
import axios from "axios"
import { useState, useEffect } from "react"

export const TestingViewPage = () => {
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);

    // This will hold the FULLY DETAILED file object, fetched on demand
    const [detailedFile, setDetailedFile] = useState<CodeFile | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    // --- NEW DATA FETCHING LOGIC ---
    // This effect triggers whenever the user selects a new file from a tree.
    useEffect(() => {
        // Clear old data first
        setDetailedFile(null);

        if (selectedNode?.type === 'file' && selectedNode.file) {
            setIsLoadingDetails(true);
            // This is the missing API call to get the full file object with symbols
            axios.get(`/api/v1/files/${selectedNode.file.id}/`)
                .then(response => {
                    setDetailedFile(response.data);
                })
                .catch(err => {
                    console.error("Failed to fetch full file details:", err);
                    // Handle error, maybe show a toast
                })
                .finally(() => {
                    setIsLoadingDetails(false);
                });
        }
    }, [selectedNode]);
    return (
        <div className="h-screen flex flex-col bg-zinc-950">
            {/* Header Section */}
            <div className="flex-shrink-0 border-b border-zinc-800/60 bg-zinc-900/30">
                <div className="px-8 py-6">
                    <div className="flex items-center justify-between">
                        {/* Left: Title and Description */}
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Testing Dashboard</h1>
                            <p className="text-zinc-400 text-base max-w-2xl">
                                Analyze test coverage, generate comprehensive test suites, and monitor testing results across your
                                codebase.
                            </p>
                        </div>

                        {/* Right: Action Buttons */}
                        <div className="flex items-center gap-3 ml-8">
                            <Button
                                variant="outline"
                                size="lg"
                                className="bg-zinc-800/50 border-zinc-700 text-zinc-200 hover:bg-zinc-700/50 hover:text-white px-6 py-3 h-auto"
                            >
                                <Settings className="w-4 h-4 mr-2" />
                                Configure
                            </Button>

                            <Button
                                variant="outline"
                                size="lg"
                                className="bg-zinc-800/50 border-zinc-700 text-zinc-200 hover:bg-zinc-700/50 hover:text-white px-6 py-3 h-auto"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Export Report
                            </Button>

                            <Button
                                variant="outline"
                                size="lg"
                                className="bg-zinc-800/50 border-zinc-700 text-zinc-200 hover:bg-zinc-700/50 hover:text-white px-6 py-3 h-auto"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Refresh Data
                            </Button>

                            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 h-auto font-medium">
                                <Play className="w-4 h-4 mr-2" />
                                Run All Tests
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabbed Content */}
            <div className="flex-1 flex flex-col min-h-0">
                <Tabs defaultValue="coverage" className="flex-1 flex flex-col min-h-0">

                    <div className="flex-shrink-0 border-b border-zinc-800/60 bg-zinc-900/20">
                        <div className="px-8"> {/* This div provides the main horizontal alignment */}
                            <TabsList className="bg-transparent border-0 p-0 h-auto">
                                <TabsTrigger
                                    value="coverage"
                                    // Remove the px-6 from here to let the parent control spacing
                                    className="bg-transparent border-0 rounded-none px-4 py-4 text-zinc-400 hover:text-zinc-200 data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 font-medium"
                                >
                                    Coverage Analysis
                                </TabsTrigger>
                                <TabsTrigger
                                    value="generation"
                                    className="bg-transparent border-0 rounded-none px-4 py-4 text-zinc-400 hover:text-zinc-200 data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-500 font-medium"
                                >
                                    Test Generation
                                </TabsTrigger>
                                <TabsTrigger
                                    value="results"
                                    className="bg-transparent border-0 rounded-none px-4 py-4 text-zinc-500 cursor-not-allowed font-medium"
                                >
                                    Test Results
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 flex flex-col min-h-0">
                        <TabsContent value="coverage" className="flex-1 flex flex-col min-h-0 px-8 py-6">
                            <CoverageDashboard />
                        </TabsContent>

                        <TabsContent value="generation" className="flex-1 flex flex-col min-h-0 px-0 py-0">
                            <TestGenerationDashboard
                                file={detailedFile}
                                isLoadingFile={isLoadingDetails}
                            />
                        </TabsContent>

                        <TabsContent value="results" className="flex flex-col flex-grow min-h-0 m-0 p-6">
                            <div className="flex items-center justify-center flex-grow">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Play className="w-8 h-8 text-zinc-500" />
                                    </div>
                                    <h3 className="text-lg font-medium text-zinc-300 mb-2">Test Results Coming Soon</h3>
                                    <p className="text-zinc-500 max-w-md">
                                        Real-time test execution results and detailed reporting will be available in this section.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
