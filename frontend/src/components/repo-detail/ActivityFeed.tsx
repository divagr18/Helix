// src/components/repo-detail/ActivityView.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { CommitGraph } from './CommitGraph';
import { InsightDetails } from './InsightDetails'; // You will create this next
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { type Insight } from '@/types';
import { toast } from 'sonner';

export const ActivityFeed: React.FC<{ repoId: number }> = ({ repoId }) => {
    const [allInsights, setAllInsights] = useState<Insight[]>([]);
    const [isLoadingInsights, setIsLoadingInsights] = useState(true);
    const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

    const fetchAllInsights = useCallback(() => {
        setIsLoadingInsights(true);
        axios.get(`/api/v1/repositories/${repoId}/insights/`)
            .then(response => {
                setAllInsights(response.data.results || response.data || []);
            })
            .catch(err => {
                console.error("Failed to fetch insights:", err);
                toast.error("Could not load repository insights.");
            })
            .finally(() => {
                setIsLoadingInsights(false);
            });
    }, [repoId]);
    useEffect(() => {
        fetchAllInsights();
    }, [fetchAllInsights]);

    // Memoize the filtered insights to avoid re-filtering on every render
    const insightsForSelectedCommit = useMemo(() => {
        if (!selectedCommit) return [];
        return allInsights.filter(insight => insight.commit_hash === selectedCommit);
    }, [selectedCommit, allInsights]);

    // Get a set of commit hashes that have insights for highlighting
    const commitsWithInsights = useMemo(() => {
        return new Set(allInsights.map(i => i.commit_hash));
    }, [allInsights]);

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            <ResizablePanel defaultSize={40} minSize={30}>
                <div className="flex flex-col h-full">
                    <div className="p-3 border-b border-border flex-shrink-0">
                        <h3 className="font-semibold text-foreground">Commit History</h3>
                    </div>
                    <div className="flex-grow min-h-0">
                        <CommitGraph
                            repoId={repoId}
                            onCommitSelect={setSelectedCommit}
                            selectedCommit={selectedCommit}
                            commitsWithInsights={commitsWithInsights}
                        />
                    </div>
                </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={60} minSize={40}>
                <InsightDetails
                    commitHash={selectedCommit}
                    insights={insightsForSelectedCommit}
                    isLoading={isLoadingInsights}
                />
            </ResizablePanel>
        </ResizablePanelGroup>
    );
};