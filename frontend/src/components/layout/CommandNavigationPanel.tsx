// src/components/layout/CommandNavigationPanel.tsx
import React from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { FileTreePanel } from '@/components/repo-detail/FileTreePanel';
import { BatchActionsPanel } from '@/components/repo-detail/BatchActionsPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, MoreHorizontal } from 'lucide-react';
import { Button } from '../ui/button';

export const CommandNavigationPanel = () => {
    const { repo, isLoadingRepo } = useRepo();

    if (isLoadingRepo) {
        return <aside className="bg-background border-r border-border p-4"><Skeleton className="h-full w-full" /></aside>;
    }
    if (!repo) {
        return <aside className="bg-background border-r border-border p-4">Repo not found.</aside>;
    }

    return (
        <aside className="bg-background border-r border-border flex flex-col overflow-y-hidden">
            <div className="p-3 border-b border-border flex-shrink-0">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold truncate">Dashboard {repo.full_name.split('/')[1]}</h3>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                </div>
                <div className="relative mt-3">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search files..." className="pl-9 h-8 bg-neutral-900 border-neutral-800" />
                </div>
            </div>

            <div className="flex-grow overflow-y-auto">
                <FileTreePanel />
            </div>
            <div className="p-3 border-t border-border mt-auto flex-shrink-0">
                <BatchActionsPanel />
            </div>
        </aside>
    );
};