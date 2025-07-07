// src/components/layout/GlobalHeader.tsx
import React from 'react';
import { RepoSelector } from './RepoSelector';
import { ChevronRight } from 'lucide-react';
// We'll need a workspace selector component as well, but let's use a placeholder for now.

export const GlobalHeader = () => {
    // Placeholder for workspace name
    const activeWorkspaceName = "My Workspace";

    return (
        <header className="h-16 flex items-center px-6 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-2 text-lg font-bold">
                {/* Logo placeholder */}
                <p>Helix</p>
            </div>
            <div className="flex items-center ml-6">
                {/* Workspace Selector Placeholder */}
                <span className="font-semibold">{activeWorkspaceName}</span>
                <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
                <RepoSelector />
            </div>
            <div className="ml-auto">
                {/* User Profile Dropdown will go here */}
            </div>
        </header>
    );
};