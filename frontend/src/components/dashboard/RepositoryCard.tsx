// src/components/dashboard/RepositoryCard.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

// Lucide Icons
import { Github, RefreshCw, Loader2, ShieldCheck, ShieldAlert, Clock, BookOpen } from 'lucide-react';

// shadcn/ui components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MoreHorizontal, Trash2 } from 'lucide-react';

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
// Utils and Types
import { getCookie } from '@/utils';
import { type TrackedRepository } from '@/pages/DashboardPage'; // Or from src/types.ts

interface RepositoryCardProps {
    repo: TrackedRepository;
    // The parent (DashboardPage) will provide this function to trigger a full list refresh
    onSyncStarted: () => void;
    onRepoDeleted: () => void; // To tell the dashboard to refresh the list after deletion

}

// Helper to determine badge color and text based on status
const getStatusInfo = (status: string): { variant: "default" | "secondary" | "destructive" | "outline", text: string } => {
    switch (status.toLowerCase()) {
        case 'completed':
            return { variant: 'default', text: 'Synced' }; // Using 'default' for a success-like state (often green if customized)
        case 'indexing':
            return { variant: 'secondary', text: 'Syncing...' };
        case 'pending':
            return { variant: 'outline', text: 'Queued' };
        case 'failed':
            return { variant: 'destructive', text: 'Failed' };
        default:
            return { variant: 'secondary', text: status };
    }
};

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repo, onSyncStarted }) => {
    // This local state is just for the instant feedback when the button is clicked,
    // before the parent's data refresh shows the new repo.status.
    const [isRequestingSync, setIsRequestingSync] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const handleDelete = async () => {
        setIsDeleting(true);
        toast.info(`Deleting ${repo.full_name}...`);
        try {
            await axios.delete(
                `/api/v1/repositories/${repo.id}/`,
                {
                    withCredentials: true,
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' }
                }
            );
            toast.success(`Successfully deleted ${repo.full_name}.`);
            onRepoDeleted(); // Trigger parent to refetch the repo list
        } catch (error) {
            const errorMsg = axios.isAxiosError(error) ? error.response?.data?.error : "An unknown error occurred.";
            console.log(error.response);
            toast.error(`Failed to delete ${repo.full_name}`, { description: String(errorMsg) });
            setIsDeleting(false); // Reset loading state only on failure
        }
        // No finally block needed, as the component will unmount on success
    };

    const handleReProcess = async () => {
        setIsRequestingSync(true);
        toast.info(`Requesting sync for ${repo.full_name}...`);
        try {
            const response = await axios.post(
                `/api/v1/repositories/${repo.id}/reprocess/`,
                {},
                {
                    withCredentials: true,
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' }
                }
            );
            toast.success(response.data.message || "Sync started successfully.");
            // Tell the parent DashboardPage to refetch all repositories.
            // This will update the repo.status prop for this card and others.
            onSyncStarted();
        } catch (error) {
            const errorMsg = axios.isAxiosError(error)
                ? error.response?.data?.message || error.response?.data?.error
                : "An unknown error occurred.";
            toast.error(`Failed to start sync for ${repo.full_name}`, {
                description: String(errorMsg),
            });
            setIsRequestingSync(false); // Reset local loading state on failure
        }
        // No need for a `finally` block to set isRequestingSync to false, because on success,
        // the parent will refetch and the repo.status prop will change to 'PENDING' or 'INDEXING',
        // which will correctly handle the button's disabled state.
    };

    const isProcessing = repo.status === 'INDEXING' || repo.status === 'PENDING' || isRequestingSync;
    const statusInfo = getStatusInfo(repo.status);

    return (
        <>
            <Card className="flex flex-col border border-border bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-shadow duration-300">
                <CardHeader className="pb-4">
                    <div className="flex items-start justify-between gap-4">
                        {/* Left side: Title and Description */}
                        <div className="flex-grow min-w-0">
                            <CardTitle className="text-lg font-semibold flex items-center gap-2 truncate">
                                <Github className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <Link
                                    to={`/code/repository/${repo.id}`}
                                    className="hover:text-primary hover:underline truncate"
                                    title={repo.full_name}
                                >
                                    {repo.full_name}
                                </Link>
                            </CardTitle>
                            <CardDescription className="pt-2 text-xs flex items-center text-muted-foreground">
                                <Clock className="h-3 w-3 mr-1.5" />
                                Last synced: {repo.last_processed ? new Date(repo.last_processed).toLocaleString() : 'Never'}
                            </CardDescription>
                        </div>

                        {/* Right side: Status Badge and Actions Dropdown */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <span className="sr-only">Open repository actions</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={onSyncStarted}>
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        <span>Sync Now</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={(e) => {
                                            e.preventDefault();
                                            setIsAlertOpen(true);
                                        }}
                                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="flex-grow">
                    {/* --- USE REAL DATA INSTEAD OF PLACEHOLDERS --- */}
                    <div className="text-sm text-muted-foreground space-y-2">
                        <div className="flex items-center gap-2">
                            <BookOpen className={`h-4 w-4 ${repo.documentation_coverage >= 80 ? 'text-green-500' : repo.documentation_coverage >= 50 ? 'text-yellow-500' : 'text-orange-500'}`} />
                            <span>{repo.documentation_coverage.toFixed(1)}% Doc Coverage</span>
                        </div>

                        {/* Conditionally render the orphan count */}
                        <div className="flex items-center gap-2">
                            <ShieldAlert className={`h-4 w-4 ${repo.orphan_symbol_count > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
                            <span>{repo.orphan_symbol_count} Orphan Symbol{repo.orphan_symbol_count !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="border-t border-border pt-4">
                    <TooltipProvider delayDuration={100}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="w-full" tabIndex={isProcessing ? -1 : undefined}>
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full"
                                        onClick={handleReProcess}
                                        disabled={isProcessing}
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                        )}
                                        {isProcessing ? 'Syncing...' : 'Sync with GitHub'}
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>Pull latest changes and re-analyze repository.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardFooter>
            </Card>

            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the{' '}
                            <strong className="mx-1">{repo.full_name}</strong> repository, its
                            analysis, insights, and all associated data from Helix.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Yes, delete this repository
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
