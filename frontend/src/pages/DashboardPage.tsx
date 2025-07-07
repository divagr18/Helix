// src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { PlusCircle, Loader2, GitBranch, Lock as Badge } from 'lucide-react';
import { toast } from 'sonner'; // <-- Import toast

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Custom Components
import { RepositoryCard } from '../components/dashboard/RepositoryCard';
import { getCookie } from '../utils';
import { useWorkspaceStore } from '@/stores/workspaceStore';

// Types (should ideally be in src/types.ts)
export interface TrackedRepository {
    id: number;
    full_name: string;
    status: string;
    last_processed: string | null;
    // --- ADD THE NEW FIELDS ---
    documentation_coverage: number;
    orphan_symbol_count: number;
    // last_processed: string; // Add if you have it
}

export interface GithubRepository {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
}

export function DashboardPage() {
    const { activeWorkspace } = useWorkspaceStore();
    const [trackedRepos, setTrackedRepos] = useState<TrackedRepository[]>([]);
    const [trackedLoading, setTrackedLoading] = useState(true);
    const [githubRepos, setGithubRepos] = useState<GithubRepository[]>([]);
    const [githubLoading, setGithubLoading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [addRepoError, setAddRepoError] = useState<string | null>(null);

    const [isAddRepoDialogOpen, setIsAddRepoDialogOpen] = useState(false);
    const [processingRepoId, setProcessingRepoId] = useState<number | null>(null); // For re-process loading state
    useEffect(() => {
        // Don't try to fetch if no workspace is selected yet
        if (!activeWorkspace) {
            setIsLoading(false);
            setTrackedRepos([]);
            return;
        }

        setIsLoading(true);
        // Fetch repositories. The backend will automatically filter by user membership.
        // We can pass the organization_id as a query param for explicit filtering.
        axios.get(`/api/v1/repositories/?organization_id=${activeWorkspace.id}`)
            .then(response => {
                setTrackedRepos(response.data);
            })
            .catch(err => {
                console.error("Failed to fetch repositories for workspace", err);
                toast.error("Could not load repositories.");
            })
            .finally(() => setIsLoading(false));
    }, [activeWorkspace]);
    const fetchTrackedRepos = useCallback((showLoadingSpinner = false) => {
        // Only show the main skeleton loader on the initial fetch
        if (showLoadingSpinner) {
            setTrackedLoading(true);
        }
        axios.get('/api/v1/repositories/', { withCredentials: true })
            .then(response => {
                // Sort repositories, e.g., by name
                const sortedRepos = response.data.sort((a: TrackedRepository, b: TrackedRepository) => a.full_name.localeCompare(b.full_name));
                setTrackedRepos(sortedRepos);
            })
            .catch(err => {
                console.error("Error fetching tracked repositories:", err);
                toast.error("Could not refresh repositories.");
            })
            .finally(() => {
                if (showLoadingSpinner) {
                    setTrackedLoading(false);
                }
            });
    }, []); // Empty dependency array as it has no external dependencies

    useEffect(() => {
        fetchTrackedRepos(true); // Fetch with loading spinner on initial mount

        // Set up polling to automatically refresh statuses every 15 seconds
        const intervalId = setInterval(() => {
            console.log("Polling for repository statuses...");
            fetchTrackedRepos(false); // Subsequent fetches don't show the main loader
        }, 15000); // Poll every 15 seconds

        // Cleanup interval on component unmount
        return () => clearInterval(intervalId);
    }, [fetchTrackedRepos]);

    const handleFetchGithubRepos = () => {
        setGithubLoading(true);
        setAddRepoError(null);
        axios.get('/api/v1/github-repos/', { withCredentials: true })
            .then(response => setGithubRepos(response.data))
            .catch(err => {
                console.error("Error fetching GitHub repositories:", err);
                setAddRepoError("Failed to fetch repositories from GitHub. Please ensure you are logged in.");
            })
            .finally(() => setGithubLoading(false));
    };

    const handleAddRepository = (repo: GithubRepository) => {

        if (!activeWorkspace) {
            toast.error("No active workspace selected.", {
                description: "Please select or create a workspace before adding a repository.",
            });
            return; // Stop the function here.
        }
        const payload = {
            name: repo.name,
            full_name: repo.full_name,
            github_id: repo.id,
            organization_id: activeWorkspace.id,
        };
        axios.post('/api/v1/repositories/', payload, {
            withCredentials: true,
            headers: { 'X-CSRFToken': getCookie('csrftoken') },
        })
            .then(() => {
                setIsAddRepoDialogOpen(false); // Close dialog on success
                fetchTrackedRepos();
                toast.success(`Repository '${repo.full_name}' added successfully!`, {
                    description: "Processing will begin shortly.",
                }); // Refresh the list
            })
            .catch(err => {
                console.error("Error adding repository:", err);
                const errorMsg = err.response?.data?.full_name || 'This repository might already be tracked.';
                setAddRepoError(errorMsg);
            });
    };

    const handleReProcessRepo = (repoId: number) => {
        setProcessingRepoId(repoId);
        // This endpoint should trigger the Celery task
        axios.post(`/api/v1/repositories/${repoId}/process/`, {}, { withCredentials: true })
            .then(() => {
                // Optionally, you might get a task ID back to poll for status
                // For now, just refresh the list after a delay or when a notification comes in
                setTimeout(fetchTrackedRepos, 2000); // Simple refresh
            })
            .catch(err => console.error(`Error re-processing repo ${repoId}:`, err))
            .finally(() => setProcessingRepoId(null));
    };

    const renderSkeletonCards = () => (
        Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col space-y-3">
                <Skeleton className="h-[125px] w-full rounded-xl" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                </div>
            </div>
        ))
    );

    return (
        <div className="p-4 md:p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Dashboard</h1>
                <Dialog open={isAddRepoDialogOpen} onOpenChange={setIsAddRepoDialogOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleFetchGithubRepos}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Repository
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[625px]">
                        <DialogHeader>
                            <DialogTitle>Add a New Repository</DialogTitle>
                            <DialogDescription>
                                Choose a repository from your GitHub account to start tracking and analyzing.
                            </DialogDescription>
                        </DialogHeader>
                        {addRepoError && (
                            <Alert variant="destructive" className="my-2">
                                <AlertDescription>{addRepoError}</AlertDescription>
                            </Alert>
                        )}
                        <ScrollArea className="max-h-[60vh] my-4">
                            {githubLoading ? (
                                <div className="p-4 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    <p className="mt-2 text-sm text-muted-foreground">Loading repositories from GitHub...</p>
                                </div>
                            ) : (
                                <div className="space-y-2 pr-4">
                                    {githubRepos.map(repo => (
                                        <div key={repo.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                                            <div className="flex items-center gap-2">
                                                <GitBranch className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{repo.full_name}</span>
                                                {repo.private && <Badge className="text-sm px-1 flex items-center justify-center leading-none">Private</Badge>}
                                            </div>
                                            <Button size="sm" onClick={() => handleAddRepository(repo)}>Add</Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddRepoDialogOpen(false)}>Cancel</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Tracked Repositories</h2>
            {trackedLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {renderSkeletonCards()}
                </div>
            ) : (
                trackedRepos.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-border rounded-lg">
                        <h3 className="text-lg font-medium">No Repositories Tracked</h3>
                        <p className="text-sm text-muted-foreground mt-1">Click "Add Repository" to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {trackedRepos.map(repo => (
                            <RepositoryCard
                                key={repo.id}
                                repo={repo}
                                onSyncStarted={fetchTrackedRepos}
                                onReProcess={handleReProcessRepo}
                                onRepoDeleted={fetchTrackedRepos}
                                isProcessing={processingRepoId === repo.id}
                            />
                        ))}
                    </div>
                )
            )}
        </div>
    );
}