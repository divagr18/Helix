// src/components/activity/CommitGraph.tsx
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Gitgraph, Orientation, templateExtend, TemplateName, Mode } from '@gitgraph/react';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

// Define the shape of the commit data from our backend
interface CommitNode {
    commit: string;
    author: string;
    date: string;
    message: string;
    parents: string[];
}

interface CommitGraphProps {
    repoId: number;
    onCommitSelect: (commitHash: string | null) => void;
    selectedCommit: string | null;
    commitsWithInsights: Set<string>; // Prop for highlighting
}

// --- REFINED STYLING TEMPLATE ---
const gitGraphTemplate = templateExtend(TemplateName.Metro, {
    colors: ["#6b7280", "#3b82f6", "#22c55e", "#f97316", "#ef4444", "#a855f7"], // Muted grays and vibrant accents
    branch: {
        lineWidth: 2,
        spacing: 35, // Tighter spacing
        label: { display: false },
    },
    commit: {
        spacing: 55, // Tighter spacing
        dot: {
            size: 6, // Smaller default dots
            strokeWidth: 0, // No border on default dots
        },
        message: {
            display: true,
            font: "13px 'Inter', sans-serif",
            color: "#FFFFFF", // Use muted text for non-selected commits
        },
    },
});

export const CommitGraph: React.FC<CommitGraphProps> = ({ repoId, onCommitSelect, selectedCommit, commitsWithInsights }) => {
    const [commits, setCommits] = useState<CommitNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);
    const [hoveredSha, setHoveredSha] = useState<string | null>(null);
    useEffect(() => {
        setIsLoading(true);
        axios.get(`/api/v1/repositories/${repoId}/commit-history/`)
            .then(response => setCommits(response.data || []))
            .catch(err => {
                setError("Could not load commit history.");
                toast.error("Could not load commit history.");
            })
            .finally(() => setIsLoading(false));
    }, [repoId]);

    const commitMap = useMemo(() => new Map(commits.map((c) => [c.commit, c])), [commits]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
    }
    if (error) {
        return <div className="flex justify-center items-center h-full text-destructive"><AlertCircle className="mr-2" />{error}</div>;
    }
    if (commits.length === 0) {
        return <div className="text-center p-8 text-muted-foreground">No commit history found.</div>;
    }

    return (
        // The parent container provides the scroll area
        <div className="h-full overflow-y-auto bg-background p-4 pl-8">
            <Gitgraph
                options={{
                    template: gitGraphTemplate,
                    orientation: Orientation.VerticalReverse,
                    // Using "compact" mode can sometimes help with complex histories, but can also be less clear.
                    // mode: Mode.Compact, 
                }}
            >
                {(gitgraph) => {
                    const renderedCommits = new Set<string>();
                    const branches = new Map<string, any>();

                    const renderCommitRecursive = (commitSha: string, currentBranch: any) => {
                        if (renderedCommits.has(commitSha)) return;

                        const commitData = commitMap.get(commitSha);
                        if (!commitData) return;

                        renderedCommits.add(commitSha);

                        // --- REFINED COMMIT RENDERING ---
                        const isSelected = selectedCommit === commitData.commit;
                        const hasInsights = commitsWithInsights.has(commitData.commit);

                        // Merge logic: The second parent and onwards create new branches and merge in.
                        if (commitData.parents.length > 1) {
                            // The first parent continues the current branch line.
                            // We render it *after* the merge commits.
                            const otherParents = commitData.parents.slice(1);
                            otherParents.forEach(parentSha => {
                                // Create a new branch for the parent to be merged.
                                const newBranch = gitgraph.branch(parentSha);
                                // Recursively render the history of this new branch.
                                renderCommitRecursive(parentSha, newBranch);
                                // Merge this branch into our current one.
                                currentBranch.merge({
                                    branch: newBranch,
                                    commitOptions: {
                                        // This is the merge commit itself
                                        subject: commitData.message,
                                        hash: commitData.commit,
                                        style: {
                                            dot: {
                                                size: isSelected ? 10 : 8,
                                                color: isSelected ? 'hsl(var(--primary))' : '#6b7280',
                                            },
                                            message: {
                                                color: isSelected ? '#FFFFFF' : '#FFFFFF',
                                                fontWeight: isSelected ? '600' : '400',
                                            },
                                        },
                                        onClick: () => onCommitSelect(commitData.commit),
                                        // Custom render function for the message to add the insight icon
                                        renderMessage: (_commit) => {
                                            const sha = commitData.commit;
                                            const isHovered = hoveredCommit === sha;
                                            return (
                                                <g
                                                    transform={`translate(20, ${_commit.style.dot.size})`}
                                                    onClick={() => onCommitSelect(sha)}
                                                    onMouseEnter={() => setHoveredCommit(sha)}
                                                    onMouseLeave={() => setHoveredCommit(null)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        opacity: isHovered ? 0.8 : 1,
                                                        transition: 'opacity 150ms ease-in-out',
                                                        pointerEvents: 'all',
                                                    }}
                                                >
                                                    {/* Dot + message + icon all live inside this <g> */}
                                                    <text
                                                        alignmentBaseline="central"
                                                        fill="#FFFFFF"
                                                        fontFamily={_commit.style.message.font}
                                                        style={{
                                                            fontWeight: _commit.style.message.fontWeight,
                                                            fontSize: '13px',
                                                        }}
                                                    >
                                                        {commitData.message}
                                                    </text>
                                                    {commitsWithInsights.has(sha) && (
                                                        <foreignObject x={5} y="-10" width="16" height="16">
                                                            <Sparkles className="h-3.5 w-3.5 text-primary/80" />
                                                        </foreignObject>
                                                    )}
                                                </g>
                                            );
                                        },
                                    },
                                });
                            });
                            // Now continue the main line of history with the first parent.
                            renderCommitRecursive(commitData.parents[0], currentBranch);
                        } else {
                            // Standard commit (0 or 1 parent)
                            currentBranch.commit({
                                subject: commitData.message,
                                hash: commitData.commit,
                                style: {
                                    dot: {
                                        size: isSelected ? 10 : 6,
                                        color: isSelected ? 'hsl(var(--primary))' : undefined,
                                    },
                                    message: {
                                        color: isSelected ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                                        fontWeight: isSelected ? '600' : '400',
                                    },
                                },

                                onClick: () => onCommitSelect(commitData.commit),
                                renderMessage: (_commit) => {
                                    const sha = commitData.commit;
                                    const isHovered = hoveredCommit === sha;
                                    return (
                                        <g
                                            transform={`translate(20, ${_commit.style.dot.size})`}
                                            onClick={() => onCommitSelect(sha)}
                                            onMouseEnter={() => setHoveredCommit(sha)}
                                            onMouseLeave={() => setHoveredCommit(null)}
                                            style={{
                                                cursor: 'pointer',
                                                opacity: isHovered ? 0.8 : 1,
                                                transition: 'opacity 150ms ease-in-out',
                                                pointerEvents: 'all',
                                            }}
                                        >
                                            {/* Dot + message + icon all live inside this <g> */}
                                            <text
                                                alignmentBaseline="central"
                                                fill="#FFFFFF"
                                                fontFamily={_commit.style.message.font}
                                                style={{
                                                    fontWeight: _commit.style.message.fontWeight,
                                                    fontSize: '13px',
                                                }}
                                            >
                                                {commitData.message}
                                            </text>
                                            {commitsWithInsights.has(sha) && (
                                                <foreignObject x={5} y="-10" width="16" height="16">
                                                    <Sparkles className="h-3.5 w-3.5 text-primary/80" />
                                                </foreignObject>
                                            )}
                                        </g>
                                    );
                                },
                            });
                            // Continue rendering history for single-parent commits.
                            if (commitData.parents.length === 1) {
                                renderCommitRecursive(commitData.parents[0], currentBranch);
                            }
                        }
                    };

                    // Find all branch heads (commits with no children in our list)
                    const parentHashes = new Set(commits.flatMap(c => c.parents));
                    const heads = commits.filter(c => !parentHashes.has(c.commit));
                    if (heads.length === 0 && commits.length > 0) heads.push(commits[0]);

                    // Start rendering from each head
                    heads.forEach(head => {
                        const branchName = head.commit;
                        if (!branches.has(branchName)) {
                            branches.set(branchName, gitgraph.branch(branchName));
                        }
                        renderCommitRecursive(head.commit, branches.get(branchName));
                    });
                }}
            </Gitgraph>
        </div>
    );
};