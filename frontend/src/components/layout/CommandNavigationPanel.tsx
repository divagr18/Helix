// src/components/layout/CommandNavigationPanel.tsx
import React from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { FileTreeHeader } from '@/components/repo-detail/FileTreeHeader';
import { FileTreePanel } from '@/components/repo-detail/FileTreePanel';
import { BatchActionsPanel } from '@/components/repo-detail/BatchActionsPanel'; // <--- 1. IMPORT THE COMPONENT
import { Skeleton } from '@/components/ui/skeleton';

export const CommandNavigationPanel = () => {
    const { repo, isLoadingRepo } = useRepo();

    return (
        <aside className="w-[350px] flex-shrink-0 border-r border-border flex flex-col bg-card overflow-y-hidden">
            {isLoadingRepo && (
                <div className="p-4 space-y-2">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-5/6" />
                </div>
            )}

            {repo && (
                <>
                    <FileTreeHeader repoFullName={repo.full_name} />

                    {/* The FileTreePanel will take up the main space */}
                    <div className="flex-grow min-h-0">
                        <FileTreePanel />
                    </div>

                    {/* --- 2. RENDER THE BATCH ACTIONS PANEL AT THE BOTTOM --- */}
                    {/* It will only render if there are files in the repo to act on */}
                    {repo.files.length > 0 && (
                        <div className="p-3 border-t border-border mt-auto flex-shrink-0 bg-background/50 shadow-inner">
                            <BatchActionsPanel />
                        </div>
                    )}
                </>
            )}
        </aside>
    );
};