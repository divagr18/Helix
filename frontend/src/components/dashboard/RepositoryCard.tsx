// src/components/dashboard/RepositoryCard.tsx
import React, { useState } from 'react';
import {
    GitBranch,
    RefreshCw,
    Loader2,
    Trash2,
    MoreHorizontal,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type DashboardRepository } from '@/pages/DashboardPage';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import axios from 'axios';
import { toast } from 'sonner';
import { getCookie } from '@/utils';

interface RepositoryCardProps {
    repo: DashboardRepository;
    onNavigate: (repo: DashboardRepository) => void;
    onSyncRequest: (repoId: number) => void;
    isSyncing: boolean;
    onRepoDeleted: (repoId: number) => void;
}

const getSyncStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
        case 'completed':
            return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs rounded-full px-2 py-0.5">Synced</Badge>;
        case 'indexing':
            return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs rounded-full px-2 py-0.5">Syncing</Badge>;
        case 'pending':
            return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs rounded-full px-2 py-0.5">Pending</Badge>;
        case 'failed':
            return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs rounded-full px-2 py-0.5">Error</Badge>;
        default:
            return <Badge variant="outline" className="border-zinc-800 text-zinc-500 bg-transparent text-xs rounded-full px-2 py-0.5">{status || 'Unknown'}</Badge>;
    }
};

const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return "text-[#22c55e]";
    if (coverage >= 60) return "text-orange-400";
    return "text-[#ef4444]";
};

const getCoverageBgColor = (coverage: number) => {
    if (coverage >= 80) return "bg-[#22c55e]";
    if (coverage >= 60) return "bg-[#fb923c]";
    return "bg-[#ef4444]";
};

const getOrphanColor = (orphans: number) => {
    if (orphans <= 5) return "text-[#22c55e]";
    if (orphans <= 15) return "text-[#fb923c]";
    return "text-[#ef4444]";
};

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repo, onNavigate, onRepoDeleted, onSyncRequest, isSyncing }) => {
    const isActionDisabled = isSyncing || repo.status.toLowerCase() === 'indexing' || repo.status.toLowerCase() === 'pending';
    const [owner, name] = repo.full_name.split('/');
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);

    const handleSyncClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSyncRequest(repo.id);
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await axios.delete(`/api/v1/repositories/${repo.id}/`, { headers: { 'X-CSRFToken': getCookie('csrftoken') } });
            toast.success(`Successfully deleted ${repo.full_name}.`);
            onRepoDeleted(repo.id);
        } catch (error) {
            toast.error("Failed to delete repository.");
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Card
                onClick={() => onNavigate(repo)}
                className="bg-zinc-900/20 border-zinc-900/50 hover:bg-zinc-900/30 transition-all duration-200 cursor-pointer group flex flex-col"
            >
                <CardHeader className="-mt-2 px-4 pb-0">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-medium text-zinc-300 tracking-tight truncate">
                            <GitBranch className="w-3.5 h-3.5 inline mr-1.5 text-zinc-500" />
                            {owner}/<span className="font-semibold text-white">{name}</span>
                        </CardTitle>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-300">
                                <DropdownMenuItem
                                    // --- THE FIX ---
                                    // 1. Stop the native click event from bubbling to the Card
                                    onClick={(e) => e.stopPropagation()}
                                    // 2. Use onSelect to perform the intended action
                                    onSelect={() => setIsAlertOpen(true)}
                                    className="text-red-400 focus:text-red-400 focus:bg-red-500/10 flex items-center cursor-pointer">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Delete</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                        {getSyncStatusBadge(repo.status)}
                        {repo.primary_language && (
                            <Badge variant="outline" className="border-zinc-800 text-zinc-500 bg-transparent text-xs rounded-full px-2 py-0.5">
                                {repo.primary_language}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-2 -mt-8 flex-grow flex flex-col justify-between">
                    <div className="space-y-3 pt-5">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-zinc-500">Last synced:</span>
                            <span className="text-zinc-400 font-mono">
                                {repo.last_processed ? new Date(repo.last_processed).toLocaleDateString() : 'Never'}
                            </span>
                        </div>

                        <div className="space-y-2 -mt-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-zinc-500">Doc Coverage</span>
                                <span className={cn("text-sm font-medium", getCoverageColor(repo.documentation_coverage))}>
                                    {repo.documentation_coverage.toFixed(1)}%
                                </span>
                            </div>
                            <div className="w-full bg-zinc-800 rounded-full h-1">
                                <div
                                    className={cn("h-1 rounded-full", getCoverageBgColor(repo.documentation_coverage))}
                                    style={{ width: `${repo.documentation_coverage}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-500">Orphan Symbols</span>
                            <span className={cn("text-sm font-medium", getOrphanColor(repo.orphan_symbol_count))}>
                                {repo.orphan_symbol_count}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-800/50">
                            <div className="text-center">
                                <p className="text-sm text-zinc-500">Size</p>
                                <p className="text-sm font-medium text-zinc-400">{(repo.size_kb / 1024).toFixed(1)}MB</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-zinc-500">Commits</p>
                                <p className="text-sm font-medium text-zinc-400">{repo.commit_count}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-sm text-zinc-500">Contributors</p>
                                <p className="text-sm font-medium text-zinc-400">{repo.contributor_count}</p>
                            </div>
                        </div>

                        <Button
                            onClick={handleSyncClick}
                            disabled={isActionDisabled}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm h-8 mt-3 disabled:bg-zinc-700 disabled:text-zinc-400 disabled:cursor-not-allowed"
                        >
                            {isActionDisabled ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4 mr-2" />
                            )}
                            {repo.status.toLowerCase() === 'indexing' || repo.status.toLowerCase() === 'pending' ? 'Syncing...' : 'Sync with GitHub'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete <strong>{repo.full_name}</strong> and all its associated data. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="bg-transparent border-zinc-700 hover:bg-zinc-800">Cancel</AlertDialogCancel>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Repository
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};