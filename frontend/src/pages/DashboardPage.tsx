// src/pages/DashboardPage.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, GitBranch, AlertTriangle, FileText, TrendingDown, Loader2, Search, Folder } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/dashboard/StatCard';
import { RepoFilters } from '@/components/dashboard/RepoFilters';
import { RepositoryCard } from '@/components/dashboard/RepositoryCard';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input'; // Import the Input component
import { getCookie } from '@/utils';

export interface DashboardRepository {
    id: number;
    full_name: string;
    repository_type: 'local' | 'github';
    status: string;
    last_processed: string | null;
    documentation_coverage: number;
    orphan_symbol_count: number;
    primary_language: string | null;
    size_kb: number;
    commit_count: number;
    contributor_count: number;
}

interface DashboardStats {
    total_repositories: number;
    avg_coverage: number;
    total_orphans: number;
    needs_attention: number;
}
export interface GithubRepository {
    id: number;
    name: string;
    full_name: string;
    private: boolean;
}
interface Workspace {
    id: number;
    name: string;
}

export function DashboardPage() {
    const navigate = useNavigate();
    const { activeWorkspace, setActiveWorkspace, setWorkspaces, setActiveRepository } = useWorkspaceStore();

    // State for dashboard data
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [repos, setRepos] = useState<DashboardRepository[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // State for UI controls
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState('name');
    const [filterKey, setFilterKey] = useState('all');
    const [syncingRepoId, setSyncingRepoId] = useState<number | null>(null);

    // State for "Add Repository" dialog
    const [isAddRepoOpen, setIsAddRepoOpen] = useState(false);
    const [githubRepos, setGithubRepos] = useState<GithubRepository[]>([]);
    const [isGithubLoading, setIsGithubLoading] = useState(false);
    const [addRepoError, setAddRepoError] = useState<string | null>(null);
    const [githubSearchQuery, setGithubSearchQuery] = useState('');

    // --- Data Fetching Logic ---

    // 1. First effect: Synchronize workspaces on mount
    useEffect(() => {
        axios.get('/api/v1/organizations/')
            .then(response => {
                const fetchedWorkspaces: Workspace[] = response.data;
                setWorkspaces(fetchedWorkspaces);

                if (fetchedWorkspaces.length > 0) {
                    const activeWorkspaceIsValid = activeWorkspace && fetchedWorkspaces.some(w => w.id === activeWorkspace.id);
                    if (!activeWorkspaceIsValid) {
                        // If persisted workspace is invalid for this user, set their first one as active.
                        // This is the key fix for new users.
                        setActiveWorkspace(fetchedWorkspaces[0]);
                    }
                } else {
                    setActiveWorkspace(null);
                }
            })
            .catch(() => toast.error("Could not load your workspaces."));
    }, [setWorkspaces, setActiveWorkspace]); // Runs once to sync user's available workspaces

    // 2. Second effect: Fetch dashboard data whenever the activeWorkspace changes
    const fetchDashboardData = useCallback((showLoader = true) => {
        if (!activeWorkspace) {
            setIsLoading(false);
            setRepos([]);
            setStats(null);
            return;
        }
        if (showLoader) setIsLoading(true);

        axios.get(`/api/v1/dashboard/summary/?organization_id=${activeWorkspace.id}`)
            .then(response => {
                setStats(response.data.stats);
                setRepos(response.data.repositories);
            })
            .catch(() => toast.error("Failed to fetch dashboard data."))
            .finally(() => setIsLoading(false));
    }, [activeWorkspace]);

    useEffect(() => {
        fetchDashboardData(); // Fetch initially
        const intervalId = setInterval(() => fetchDashboardData(false), 30000); // Poll in background
        return () => clearInterval(intervalId);
    }, [fetchDashboardData]);

    const handleNavigate = (repo: DashboardRepository) => {
        setActiveRepository(repo);
        navigate(`/repository/${repo.id}/code`);
    };

    const handleRepoDeleted = (repoId: number) => {
        setRepos(prev => prev.filter(r => r.id !== repoId));
        // No need for a toast here, the main delete function in the card already shows one.
    };

    const handleFetchGithubRepos = () => {
        setIsGithubLoading(true);
        setAddRepoError(null);
        setGithubSearchQuery(''); // Reset search on open
        axios.get('/api/v1/github-repos/')
            .then(response => setGithubRepos(response.data))
            .catch(() => setAddRepoError("Failed to fetch repositories from GitHub."))
            .finally(() => setIsGithubLoading(false));
    };

    const handleAddRepository = (repo: GithubRepository) => {
        if (!activeWorkspace) {
            toast.error("No active workspace selected.", {
                description: "Please select or create a workspace before adding a repository.",
            });
            setAddRepoError("No active workspace selected.");
            return;
        }
        const payload = {
            github_id: repo.id,
            full_name: repo.full_name,
            organization_id: activeWorkspace.id,
        };
        toast.info(`Adding ${repo.full_name}...`);
        axios.post('/api/v1/repositories/', payload, { headers: { 'X-CSRFToken': getCookie('csrftoken') } })
            .then(() => {
                toast.success(`${repo.full_name} added successfully!`);
                setIsAddRepoOpen(false);
                fetchDashboardData(false);
            })
            .catch(err => {
                const errorMsg = err.response?.data?.full_name?.[0] || err.response?.data?.organization_id?.[0] || 'An error occurred.';
                setAddRepoError(errorMsg);
            });
    };

    const handleSyncRequest = async (repoId: number) => {
        setSyncingRepoId(repoId); // Set loading state for the specific card
        toast.info("Requesting sync for repository...");
        try {
            await axios.post(
                `/api/v1/repositories/${repoId}/reprocess/`,
                {}, // Empty body for the POST request
                { headers: { 'X-CSRFToken': getCookie('csrftoken') } }
            );
            toast.success("Sync request sent successfully.", {
                description: "The repository status will update shortly.",
            });
            // After sending the request, we can trigger a background refresh
            // to see the status change to "Pending" or "Indexing".
            setTimeout(() => fetchDashboardData(false), 2000); // Refresh after 2 seconds
        } catch (error) {
            toast.error("Failed to start sync.", {
                description: "Please try again later.",
            });
        } finally {
            // We can clear the syncing state here, as the card's disabled
            // state will now be controlled by the repo.status from the API.
            setSyncingRepoId(null);
        }
    };

    const filteredAndSortedRepos = useMemo(() => {
        return repos
            .filter(repo => repo.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
            .filter(repo => {
                if (filterKey === 'high-coverage') return repo.documentation_coverage >= 80;
                if (filterKey === 'needs-attention') return repo.documentation_coverage < 60 || repo.orphan_symbol_count > 10;
                return true;
            })
            .sort((a, b) => {
                if (sortKey === 'coverage') return b.documentation_coverage - a.documentation_coverage;
                if (sortKey === 'orphans') return b.orphan_symbol_count - a.orphan_symbol_count;
                if (sortKey === 'last_synced') return new Date(b.last_processed || 0).getTime() - new Date(a.last_processed || 0).getTime();
                return a.full_name.localeCompare(b.full_name);
            });
    }, [repos, searchQuery, sortKey, filterKey]);

    // --- FILTERED GITHUB REPOS FOR THE MODAL ---
    const filteredGithubRepos = useMemo(() => {
        return githubRepos.filter(repo =>
            repo.full_name.toLowerCase().includes(githubSearchQuery.toLowerCase())
        );
    }, [githubRepos, githubSearchQuery]);

    const getCoverageColor = (coverage: number) => {
        if (coverage >= 80) return "text-green-400";
        if (coverage >= 60) return "text-orange-400";
        return "text-red-400";
    };

    const getOrphanColor = (orphans: number) => {
        if (orphans <= 5) return "text-green-400";
        if (orphans <= 15) return "text-orange-400";
        return "text-red-400";
    };

    return (
        <div className="min-h-screen bg-zinc-950 text-white p-6" style={{ fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl ml-1 font-bold text-white tracking-tight">Dashboard</h1>
                    <p className="text-sm text-zinc-400 mt-1 ml-1">Tracked Repositories</p>
                </div>
                <Dialog open={isAddRepoOpen} onOpenChange={setIsAddRepoOpen}>
                    <DialogTrigger asChild>
                        <Button onClick={handleFetchGithubRepos} className="bg-blue-500 hover:bg-blue-600 text-white text-xs h-8 px-3">
                            <Plus className="w-3.5 h-4 mr-2" />
                            Add Repository
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-300 sm:max-w-[625px]">
                        <DialogHeader>
                            <DialogTitle className="text-white">Add a Repository</DialogTitle>
                            <DialogDescription>Choose how you want to add a repository for analysis.</DialogDescription>
                        </DialogHeader>

                        {/* Repository Type Selection */}
                        <div className="space-y-4">
                            {/* Local Repository Option */}
                            <div className="border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors">
                                <div className="flex items-start space-x-3">
                                    <Folder className="h-5 w-5 text-blue-400 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="font-medium text-white">Local Upload</h3>
                                        <p className="text-sm text-zinc-400 mt-1">
                                            Upload and analyze a Python project from your local machine
                                        </p>
                                        <p className="text-xs text-blue-400 mt-1">
                                            Python (.py) files only
                                        </p>
                                        <Button
                                            onClick={() => {
                                                setIsAddRepoOpen(false);
                                                navigate('/local-analysis');
                                            }}
                                            className="mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm"
                                            size="sm"
                                        >
                                            Upload Folder
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* GitHub Repository Option */}
                            <div className="border border-zinc-700 rounded-lg p-4">
                                <div className="flex items-start space-x-3 mb-3">
                                    <GitBranch className="h-5 w-5 text-green-400 mt-0.5" />
                                    <div className="flex-1">
                                        <h3 className="font-medium text-white">GitHub Repository</h3>
                                        <p className="text-sm text-zinc-400 mt-1">
                                            Import and analyze a repository from your GitHub account
                                        </p>
                                    </div>
                                </div>

                                {addRepoError && <p className="text-sm text-red-400 p-2 bg-red-500/10 rounded-md mb-3">{addRepoError}</p>}

                                {/* Search Bar */}
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                                    <Input
                                        placeholder="Search GitHub repositories..."
                                        value={githubSearchQuery}
                                        onChange={(e) => setGithubSearchQuery(e.target.value)}
                                        className="pl-10 bg-zinc-800/50 border-zinc-700 focus:ring-blue-500"
                                    />
                                </div>

                                <ScrollArea className="h-[35vh] border border-zinc-800 rounded-md">
                                    <div className="p-2">
                                        {isGithubLoading ? (
                                            <div className="flex items-center justify-center h-32">
                                                <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                                            </div>
                                        ) : (
                                            <>
                                                {filteredGithubRepos.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {filteredGithubRepos.map(repo => (
                                                            <div key={repo.id} className="flex items-center justify-between p-2 rounded-md hover:bg-zinc-800/50">
                                                                <div className="flex items-center gap-2">
                                                                    <GitBranch className="h-4 w-4 text-zinc-500" />
                                                                    <span className="font-medium text-zinc-300">{repo.full_name}</span>
                                                                </div>
                                                                <Button size="sm" className="h-7 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300" onClick={() => handleAddRepository(repo)}>Add</Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
                                                        No repositories found.
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {isLoading || !stats ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[66px] bg-zinc-900/50" />)
                ) : (
                    <>
                        <StatCard title="Total Repositories" value={stats.total_repositories} icon={GitBranch} />
                        <StatCard title="Avg Coverage" value={`${stats.avg_coverage.toFixed(1)}%`} icon={FileText} valueClassName={getCoverageColor(stats.avg_coverage)} />
                        <StatCard title="Total Orphans" value={stats.total_orphans} icon={AlertTriangle} valueClassName={getOrphanColor(stats.total_orphans)} />
                        <StatCard title="Needs Attention" value={stats.needs_attention} icon={TrendingDown} valueClassName="text-red-400" />
                    </>
                )}
            </div>

            <div className="mb-6">
                <RepoFilters
                    onSearchChange={setSearchQuery}
                    onSortChange={setSortKey}
                    onFilterChange={setFilterKey}
                    sortValue={sortKey}
                    filterValue={filterKey}
                />
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[320px] bg-zinc-900/50" />)}
                </div>
            ) : (
                <>
                    {filteredAndSortedRepos.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredAndSortedRepos.map(repo => (
                                <RepositoryCard
                                    key={repo.id}
                                    repo={repo}
                                    onNavigate={handleNavigate}
                                    onSyncRequest={handleSyncRequest}
                                    onRepoDeleted={handleRepoDeleted}
                                    isSyncing={syncingRepoId === repo.id}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-zinc-500 text-sm">No repositories found matching your criteria.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}