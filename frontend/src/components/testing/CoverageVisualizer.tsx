// src/components/testing/CoverageVisualizer.tsx
import React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { CoverageFileTree } from './CoverageFileTree';
import { CoverageCodeView } from './CoverageCodeView';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
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

    const selectedCoverage = selectedNode
        ? report.file_coverages.find(fc => fc.file_path === selectedNode.path)
        : null;

    return (
        <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-start flex-shrink-0">
                <div className="p-4 border rounded-lg bg-card">
                    <h3 className="font-semibold">Overall Coverage</h3>
                    <Progress value={report.overall_coverage * 100} className="mt-2" />
                    <p className="text-2xl font-bold mt-1">{(report.overall_coverage * 100).toFixed(2)}%</p>
                </div>
                <Button variant="outline" onClick={onUploadNew}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload New Report
                </Button>
            </div>

            <ResizablePanelGroup direction="horizontal" className="flex-grow border rounded-lg bg-card min-h-0">
                <ResizablePanel defaultSize={30} minSize={20}>
                    <div className="h-full overflow-y-auto">
                        <CoverageFileTree
                            report={report}
                            onSelect={onSelectNode} // Use the prop
                            selectedPath={selectedNode?.path || null}
                        />
                    </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={70}>
                    {isLoadingContent ? (
                        <div className="flex items-center justify-center h-full">Loading code...</div>
                    ) : selectedNode && selectedCoverage && fileContent ? (
                        <CoverageCodeView
                            filePath={selectedNode.path}
                            content={fileContent}
                            // Pass the line number arrays down to the code view
                            coveredLines={selectedCoverage.covered_lines || []}
                            missedLines={selectedCoverage.missed_lines || []}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">Select a file to view its coverage details.</p>
                        </div>
                    )}
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
};