import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Gitgraph, Orientation, templateExtend, TemplateName, type Branch, type Commit } from '@gitgraph/react';
import { Loader2, AlertCircle, GitBranch, User, Calendar } from 'lucide-react';
import { toast } from 'sonner';

// The data structure for a single commit, matching the backend API response.
interface CommitNode {
    commit: string;
    author: string;
    date: string;
    message: string;
    parents: string[]; // This is an array of parent commit hashes.
}

// Props expected by the CommitGraph component from its parent (ActivityView).
interface CommitGraphProps {
    repoId: number;
    onCommitSelect: (commitHash: string | null) => void;
    selectedCommit: string | null;
}

// A custom template for @gitgraph/react to create a dark, modern theme.
const gitGraphTemplate = templateExtend(TemplateName.Metro, {
    colors: ["#60a5fa", "#34d399", "#facc15", "#f87171", "#a78bfa"], // Branch colors
    branch: {
        lineWidth: 2,
        spacing: 40,
        label: { display: false }, // We don't need to show branch names for this view.
    },
    commit: {
        spacing: 70, // Increased vertical spacing to fit our custom component.
        dot: {
            size: 8,
        },
        message: {
            display: false, // CRITICAL: Disable the default SVG text message.
        },
    },
});

// A custom React component to render the details for each commit.
// This gives us full control over styling with HTML and CSS (via Tailwind).

export const CommitGraph: React.FC<CommitGraphProps> = ({ repoId, onCommitSelect, selectedCommit }) => {
    const [commits, setCommits] = useState<CommitNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Effect to fetch commit history from the backend when the component mounts or repoId changes.
    useEffect(() => {
        setIsLoading(true);
        setError(null);

        axios.get<CommitNode[]>(`http://localhost:8000/api/v1/repositories/${repoId}/commit-history/`)
            .then(({ data }) => {
                // The backend provides the data in the correct format.
                // We just sort it by date descending to ensure we process the newest commits first.
                const sortedCommits = (data || []).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                setCommits(sortedCommits);
            })
            .catch(err => {
                console.error('Failed to fetch commit history:', err);
                const msg = axios.isAxiosError(err)
                    ? err.response?.data?.error || 'Could not load commit history.'
                    : 'An unknown error occurred.';
                setError(msg);
                toast.error(msg);
            })
            .finally(() => setIsLoading(false));
    }, [repoId]);

    // Memoize the commit map for efficient O(1) lookups by hash during graph rendering.
    const commitMap = useMemo(() => new Map(commits.map(c => [c.commit, c])), [commits]);

    // Render loading state
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // Render error state
    if (error) {
        return (
            <div className="flex justify-center items-center h-full text-destructive p-4 text-center">
                <AlertCircle className="mr-2 h-5 w-5" />
                {error}
            </div>
        );
    }

    // Render empty state
    if (commits.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground">
                <GitBranch className="h-10 w-10 mx-auto mb-4" />
                <p>No commit history found for this repository.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto bg-background p-4">
            <Gitgraph
                options={{
                    template: gitGraphTemplate,
                    orientation: Orientation.VerticalReverse,
                }}
            >
                {(gitgraph) => {
                    // --- THIS IS THE CORRECTED RENDERING LOGIC ---
                    const branchMap = new Map<string, Branch<React.ReactElement<SVGElement>>>();
                    const renderedCommits = new Set<string>();

                    // This recursive function is a more reliable way to build the graph
                    const renderGraphRecursive = (commitSha: string) => {
                        // 1. Base cases: stop if commit is invalid or already rendered
                        if (!commitSha || renderedCommits.has(commitSha)) return;

                        const commitData = commitMap.get(commitSha);
                        if (!commitData) return;

                        // 2. Render the parent(s) first
                        commitData.parents.forEach(parentSha => renderGraphRecursive(parentSha));

                        // 3. Determine the target branch for this commit
                        let targetBranch: Branch<React.ReactElement<SVGElement>>;
                        if (commitData.parents.length === 0) {
                            // Root commit: create the main branch
                            targetBranch = gitgraph.branch("main");
                        } else {
                            // Default to the branch of the first parent
                            targetBranch = branchMap.get(commitData.parents[0])!;
                            if (!targetBranch) {
                                // This case handles a parent that is the start of a new branch line
                                targetBranch = gitgraph.branch({ from: commitData.parents[0] });
                            }
                        }

                        // 4. Create the commit options, using the REAL commit hash as the key
                        const isSelected = selectedCommit === commitData.commit;
                        const commitOptions = {
                            subject: commitData.message,
                            hash: commitData.commit, // USE THE REAL, UNIQUE HASH
                            onClick: () => onCommitSelect(commitData.commit),
                            renderMessage: (c: Commit<React.ReactElement<SVGElement>>) => <CustomCommitMessage commit={c} isSelected={isSelected} />,
                            attributes: { data: commitData },
                        };

                        // 5. Handle merges vs. regular commits
                        if (commitData.parents.length > 1) {
                            const branchToMerge = branchMap.get(commitData.parents[1]);
                            if (branchToMerge && branchToMerge !== targetBranch) {
                                targetBranch.merge({
                                    branch: branchToMerge,
                                    fastForward: false,
                                    commitOptions,
                                });
                            } else {
                                // Fallback if merge target is weird, just commit it
                                targetBranch.commit(commitOptions);
                            }
                        } else {
                            // Regular commit
                            targetBranch.commit(commitOptions);
                        }

                        // 6. Mark as rendered and map the branch for children to find
                        renderedCommits.add(commitData.commit);
                        branchMap.set(commitData.commit, targetBranch);
                    };

                    // To build the graph correctly, we must start from the "heads"
                    // (commits that are not parents of any other commit in our list)
                    const parentHashes = new Set(commits.flatMap(c => c.parents));
                    const heads = commits.filter(c => !parentHashes.has(c.commit));

                    if (heads.length > 0) {
                        heads.forEach(head => renderGraphRecursive(head.commit));
                    } else if (commits.length > 0) {
                        // Fallback for a simple, linear history where every commit is a parent
                        renderGraphRecursive(commits[0].commit);
                    }
                }}
            </Gitgraph>
        </div>
    );
};

// You need to re-include the CustomCommitMessage component here as well
const CustomCommitMessage: React.FC<{ commit: Commit<React.ReactElement<SVGElement>>; isSelected: boolean }> = ({ commit, isSelected }) => {
    const commitData = commit.attributes.data as CommitNode;
    return (
        <foreignObject x={20} y={-25} width="300" height="60">
            <div
                xmlns="http://www.w3.org/1999/xhtml"
                className={`p-2 rounded-md transition-all duration-200 w-full h-full ${isSelected ? 'bg-primary/10 border border-primary/50' : 'bg-transparent'}`}
            >
                <p className={`font-semibold truncate text-sm ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {commitData.message}
                </p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1.5">
                    <div className="flex items-center gap-1.5"><User className="h-3 w-3" /><span>{commitData.author}</span></div>
                    <div className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /><span>{new Date(commitData.date).toLocaleDateString()}</span></div>
                </div>
            </div>
        </foreignObject>
    );
};