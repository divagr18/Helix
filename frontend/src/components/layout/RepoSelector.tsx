// src/components/layout/RepoSelector.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronsUpDown } from 'lucide-react';

export const RepoSelector = () => {
    const { activeWorkspace, activeRepository, setActiveRepository } = useWorkspaceStore();
    const navigate = useNavigate();

    // This assumes activeWorkspace contains a list of repositories.
    // We may need to fetch this list separately if it's not already loaded.
    const repositories = activeWorkspace?.repositories || [];

    const handleRepoChange = (repoSlug: string) => {
        const selectedRepo = repositories.find(r => r.slug === repoSlug);
        if (selectedRepo && activeWorkspace) {
            setActiveRepository(selectedRepo);
            // Navigate to the default "code" view for the newly selected repo
            navigate(`/${activeWorkspace.slug}/${selectedRepo.slug}/code`);
        }
    };

    if (!activeWorkspace) {
        return null; // Don't show if no workspace is active
    }

    return (
        <Select
            value={activeRepository?.slug}
            onValueChange={handleRepoChange}
        >
            <SelectTrigger className="w-[250px] text-base font-semibold border-none focus:ring-0">
                <SelectValue placeholder="Select a Repository..." />
            </SelectTrigger>
            <SelectContent>
                {repositories.map(repo => (
                    <SelectItem key={repo.id} value={repo.slug}>
                        {repo.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};