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
                setGraphSize({ width, height: height > 0 ? height : 400 });
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
                .then(response => {
                    setGraphData(response.data);
                })
                .catch(err => console.error("Failed to fetch complexity graph", err))
                .finally(() => setIsLoading(false));
        }
    }, [activeRepository]);

    if (!activeRepository) return <p>Please select a repository.</p>;
    if (isLoading) return <p>Loading complexity hotspots...</p>;

    return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-[minmax(0,_2fr)_minmax(0,_1fr)] gap-6">
            {/* Left Column: Visualization */}
            <div className="bg-card border border-border rounded-lg p-4 flex flex-col">
                <div className="flex-shrink-0">
                    <h3 className="font-semibold">Complexity Call Graph</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Nodes are sized by complexity. Lines represent function calls.
                    </p>
                </div>
                <div ref={graphContainerRef} className="flex-grow w-full h-full flex justify-center items-center min-h-[400px]">
                    {isLoading ? (
                        <Skeleton className="w-full h-full" />
                    ) : graphData && graphData.nodes.length > 0 ? (
                        <ComplexityGraph
                            nodesData={graphData.nodes}
                            linksData={graphData.links}
                            onNodeHover={setHighlightedSymbolId}
                            highlightedNodeId={highlightedSymbolId}
                            width={graphSize.width}
                            height={graphSize.height}
                        />
                    ) : (
                        <p>No complexity data to display.</p>
                    )}
                </div>
            </div>

            {/* Right Column: Details List */}
            <div className="h-full">
                <FunctionDetailList
                    symbols={graphData?.nodes || []}
                    onSymbolHover={setHighlightedSymbolId}
                    highlightedSymbolId={highlightedSymbolId}
                />
            </div>
        </div>
    );
};