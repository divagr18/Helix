import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { type CodeSymbol, type ComplexityGraphData } from '@/types';
import { ComplexityGraph } from './ComplexityGraph';
import { FunctionDetailList } from './FunctionDetailList';
import { Skeleton } from '@/components/ui/skeleton';

export const RefactoringDashboard = () => {
    const { activeRepository } = useWorkspaceStore();
    const [graphData, setGraphData] = useState<ComplexityGraphData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [highlightedSymbolId, setHighlightedSymbolId] = useState<number | null>(null);

    // --- Responsive Graph Size ---
    const graphContainerRef = useRef<HTMLDivElement>(null);
    const [graphSize, setGraphSize] = useState({ width: 600, height: 400 });

    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0]) {
                const { width, height } = entries[0].contentRect;
                // Ensure minimum dimensions and account for padding/borders
                const paddedWidth = Math.max(width - 32, 200); // Account for container padding
                const paddedHeight = Math.max(height - 32, 150); // Account for container padding
                setGraphSize({
                    width: paddedWidth,
                    height: paddedHeight
                });
            }
        });
        if (graphContainerRef.current) {
            resizeObserver.observe(graphContainerRef.current);
        }
        return () => resizeObserver.disconnect();
    }, []);

    // --- Data Fetching ---
    useEffect(() => {
        if (activeRepository) {
            setIsLoading(true);
            axios.get(`/api/v1/repositories/${activeRepository.id}/intelligence/complexity-graph/`)
                .then(resp => setGraphData(resp.data))
                .catch(err => console.error("Failed to fetch complexity graph", err))
                .finally(() => setIsLoading(false));
        }
    }, [activeRepository]);

    if (!activeRepository) return <p>Please select a repository.</p>;

    return (
        /* Fixed: use h-full since parent now properly constrains height */
        <div className="h-full max-h-full grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 overflow-hidden">
            {/* Left: graph */}
            <div className="flex flex-col bg-card border border-border rounded-lg p-4 min-h-0 overflow-hidden">
                <div className="flex-shrink-0 mb-4">
                    <h3 className="font-semibold">Complexity Call Graph</h3>
                    <p className="text-sm text-muted-foreground">
                        Nodes sized by complexity. Edges = calls. Click on a node to refactor.
                    </p>
                </div>
                <div
                    ref={graphContainerRef}
                    className="flex-grow w-full h-full overflow-hidden flex justify-center items-center min-h-0"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                >
                    {isLoading ? (
                        <Skeleton className="w-full h-full" />
                    ) : graphData?.nodes.length ? (
                        <ComplexityGraph
                            nodesData={graphData.nodes}
                            linksData={graphData.links}
                            onNodeHover={setHighlightedSymbolId}
                            highlightedNodeId={highlightedSymbolId}
                            width={Math.min(graphSize.width, graphSize.width)}
                            height={Math.min(graphSize.height, graphSize.height)}
                        />
                    ) : (
                        <p>No complexity data to display.</p>
                    )}
                </div>
            </div>

            {/* Right: details list */}
            <div className="min-h-0 overflow-hidden flex flex-col">
                {isLoading ? (
                    <Skeleton className="w-full h-full" />
                ) : (
                    <FunctionDetailList
                        symbols={graphData?.nodes || []}
                        onSymbolHover={setHighlightedSymbolId}
                        highlightedSymbolId={highlightedSymbolId}
                    />
                )}
            </div>
        </div>
    );
};