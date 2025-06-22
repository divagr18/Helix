// src/components/dashboard/RepositoryCard.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

// Lucide Icons
import { Github, RefreshCw, Loader2, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

// shadcn/ui components
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Utils and Types
import { getCookie } from '@/utils';
import { type TrackedRepository } from '@/pages/DashboardPage'; // Or from src/types.ts

interface RepositoryCardProps {
    repo: TrackedRepository;
    // The parent (DashboardPage) will provide this function to trigger a full list refresh
    onSyncStarted: () => void;
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

    const handleReProcess = async () => {
        setIsRequestingSync(true);
        toast.info(`Requesting sync for ${repo.full_name}...`);
        try {
            const response = await axios.post(
                `http://localhost:8000/api/v1/repositories/${repo.id}/reprocess/`,
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
        <Card className="flex flex-col border border-border bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-shadow duration-300">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Github className="h-5 w-5 text-muted-foreground" />
                        <Link to={`/repository/${repo.id}`} className="hover:text-primary hover:underline">
                            {repo.full_name}
                        </Link>
                    </CardTitle>
                    <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>
                </div>
                <CardDescription className="pt-2 text-xs flex items-center text-muted-foreground">
                    <Clock className="h-3 w-3 mr-1.5" />
                    Last synced: {repo.last_processed ? new Date(repo.last_processed).toLocaleString() : 'Never'}
                </CardDescription>
            </CardHeader>

            <CardContent className="flex-grow">
                {/* Placeholder for future health metrics */}
                <div className="text-sm text-muted-foreground space-y-2">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <span>92% Documentation Coverage</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-yellow-500" />
                        <span>3 Orphan Symbols</span>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="border-t border-border pt-4">
                <TooltipProvider delayDuration={100}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            {/* The button is wrapped in a span to allow the tooltip to show even when the button is disabled */}
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
    );
};