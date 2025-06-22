// src/components/repo-detail/ActivityFeed.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { GitCommit, GitBranchPlus, GitBranch, FileMinus2 as GitBranchMinus, GitPullRequest, AlertCircle, Loader2 } from 'lucide-react';
import { type Insight } from '@/types'; // Assuming you create this type
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// Helper to get an icon for each insight type
const InsightIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'SYMBOL_ADDED': return <GitBranchPlus className="h-4 w-4 text-green-500" />;
        case 'SYMBOL_REMOVED': return <GitBranchMinus className="h-4 w-4 text-red-500" />;
        case 'SYMBOL_MODIFIED': return <GitBranch className="h-4 w-4 text-blue-500" />;
        default: return <GitCommit className="h-4 w-4 text-muted-foreground" />;
    }
};

interface ActivityFeedProps {
    repoId: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ repoId }) => {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInsights = useCallback(() => {
        setIsLoading(true);
        axios.get(`http://localhost:8000/api/v1/repositories/${repoId}/insights/`)
            .then(response => {
                setInsights(response.data.results || response.data); // Handle paginated or non-paginated response
            })
            .catch(err => {
                console.error("Failed to fetch repository activity:", err);
                setError("Could not load activity feed.");
                toast.error("Could not load activity feed.");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [repoId]);

    useEffect(() => {
        fetchInsights();
    }, [fetchInsights]);

    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (error) {
        return <div className="flex justify-center items-center p-8 text-destructive"><AlertCircle className="mr-2"/>{error}</div>;
    }

    if (insights.length === 0) {
        return <div className="text-center p-8 text-muted-foreground">No recent activity or insights found for this repository.</div>;
    }

    // Group insights by commit hash
    const insightsByCommit = insights.reduce((acc, insight) => {
        (acc[insight.commit_hash] = acc[insight.commit_hash] || []).push(insight);
        return acc;
    }, {} as Record<string, Insight[]>);

    return (
        <ScrollArea className="h-full">
            <div className="p-4 md:p-6 space-y-6">
                {Object.entries(insightsByCommit).map(([commitHash, commitInsights]) => (
                    <div key={commitHash} className="relative pl-8">
                        <div className="absolute left-0 top-0 flex items-center">
                            <span className="h-full w-px bg-border -translate-x-px translate-y-4"></span>
                            <GitCommit className="h-5 w-5 text-muted-foreground bg-background rounded-full z-10" />
                        </div>
                        <div className="pb-6">
                            <p className="text-sm font-mono text-muted-foreground">{commitHash.substring(0, 7)}</p>
                            <p className="text-xs text-muted-foreground">
                                Changes committed on {new Date(commitInsights[0].created_at).toLocaleDateString()}
                            </p>
                            <div className="mt-2 space-y-2">
                                {commitInsights.map(insight => (
                                    <div key={insight.id} className="flex items-start gap-3 text-sm">
                                        <div className="mt-1"><InsightIcon type={insight.insight_type} /></div>
                                        <p className="text-foreground">
                                            {insight.message.split("'")[0]}
                                            {insight.related_symbol ? (
                                                <Link to={`/symbol/${insight.related_symbol.id}`} className="font-semibold text-primary hover:underline mx-1">
                                                    '{insight.related_symbol.name}'
                                                </Link>
                                            ) : (
                                                <span className="font-semibold mx-1">'{insight.data.name}'</span>
                                            )}
                                            {insight.message.split("'").slice(2).join("'")}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );
};