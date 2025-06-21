// src/components/dashboard/RepositoryCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Github, GitBranch, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type TrackedRepository } from '@/pages/DashboardPage'; // Assuming type is exported from DashboardPage or is in src/types.ts

interface RepositoryCardProps {
    repo: TrackedRepository;
    onReProcess: (repoId: number) => void; // Handler for the re-process action
    isProcessing: boolean; // To show loading state on the button
}

// Helper to determine badge color based on status
const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status.toLowerCase()) {
        case 'completed':
            return 'default'; // Or a custom 'success' variant
        case 'processing':
            return 'secondary';
        case 'failed':
            return 'destructive';
        case 'pending':
            return 'outline';
        default:
            return 'secondary';
    }
};

export const RepositoryCard: React.FC<RepositoryCardProps> = ({ repo, onReProcess, isProcessing }) => {
    return (
        <Card className="flex flex-col shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Github className="h-5 w-5 text-muted-foreground" />
                        <Link to={`/repository/${repo.id}`} className="hover:text-primary hover:underline">
                            {repo.full_name}
                        </Link>
                    </CardTitle>
                    <Badge variant={getStatusVariant(repo.status)}>{repo.status}</Badge>
                </div>
                {/* Optional: Add more metadata if available */}
                {/* <CardDescription className="pt-2 text-xs">Last processed: {new Date(repo.last_processed).toLocaleString()}</CardDescription> */}
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
            <CardFooter className="border-t border-border pt-3">
                <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => onReProcess(repo.id)}
                    disabled={isProcessing || repo.status === 'Processing'}
                >
                    {isProcessing ? (
                        <Clock className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Clock className="mr-2 h-4 w-4" />
                    )}
                    {isProcessing ? 'Processing...' : 'Re-Process Now'}
                </Button>
            </CardFooter>
        </Card>
    );
};