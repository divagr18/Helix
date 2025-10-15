// src/components/testing/CoverageVisualizer.tsx
import React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CoverageFileTree } from './CoverageFileTree';
import { CoverageCodeView } from './CoverageCodeView';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { BarChart3, FileIcon, Upload } from 'lucide-react';
import { type TreeNode } from '@/utils/tree';

// --- NEW, SIMPLIFIED PROPS ---
interface CoverageVisualizerProps {
    report: any;
    onUploadNew: () => void;
    onSelectNode: (node: TreeNode) => void;
    selectedNode: TreeNode | null;
    fileContent: string | null;
    isLoadingContent: boolean;
}

export const CoverageVisualizer: React.FC<CoverageVisualizerProps> = ({
    report,
    onUploadNew,
    onSelectNode,
    selectedNode,
    fileContent,
    isLoadingContent,
}) => {
    // No more useState or useEffect here! It's just a display component.
    const overallCoveragePercent = report.overall_coverage * 100;
    const selectedCoverage = selectedNode
        ? report.file_coverages.find(fc => fc.file_path === selectedNode.path)
        : null;

    return (
        <div className="space-y-6 h-full flex flex-col">
            {/* --- RESTYLED HEADER --- */}
            <div className="flex justify-between items-center flex-shrink-0">
                <div className="p-4 border border-zinc-800/60 bg-zinc-900/50 rounded-lg">
                    <h3 className="text-sm font-medium text-zinc-400 flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Overall Coverage
                    </h3>
                    <p className="text-3xl font-bold text-white mt-1">{overallCoveragePercent.toFixed(2)}%</p>
                    <Progress value={overallCoveragePercent} className="mt-2 h-1.5" />
                </div>
                <Button variant="outline" onClick={onUploadNew} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 bg-transparent">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload New Report
                </Button>
            </div>

            {/* --- RESTYLED RESIZABLE PANEL GROUP --- */}
            <ResizablePanelGroup direction="horizontal" className="flex-grow border border-zinc-800/60 rounded-lg bg-zinc-900/50 min-h-0">
                <ResizablePanel defaultSize={30} minSize={20}>
                    <div className="h-full flex flex-col">
                        <div className="p-3 border-b border-zinc-800/60">
                            <h3 className="font-medium text-zinc-200 text-sm">File Explorer</h3>
                        </div>
                        <div className="flex-grow overflow-y-auto">
                            <CoverageFileTree
                                report={report}
                                onSelect={onSelectNode}
                                selectedPath={selectedNode?.path || null}
                            />
                        </div>
                    </div>
                </ResizablePanel>
                <ResizableHandle withHandle className="bg-zinc-800/60 hover:bg-zinc-700/60 transition-colors" />
                <ResizablePanel defaultSize={70}>
                    {isLoadingContent ? (
                        <div className="flex items-center justify-center h-full text-zinc-500">Loading code...</div>
                    ) : selectedNode && selectedCoverage && fileContent ? (
                        <CoverageCodeView
                            filePath={selectedNode.path}
                            content={fileContent}
                            coveredLines={selectedCoverage.covered_lines || []}
                            missedLines={selectedCoverage.missed_lines || []}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <FileIcon className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                                <p className="text-zinc-400 text-sm">Select a file to view its coverage details</p>
                            </div>
                        </div>
                    )}
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};