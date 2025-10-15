// src/components/layout/BranchSelector.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check, GitBranch, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from 'sonner';

interface BranchInfo {
    name: string;
    commit_sha: string;
    commit_message: string;
    last_modified: string;
    is_default: boolean;
    is_current: boolean;
}

export const BranchSelector = () => {
    const [open, setOpen] = useState(false);
    const [branches, setBranches] = useState<BranchInfo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSwitching, setIsSwitching] = useState(false);
    const { activeRepository } = useWorkspaceStore();

    const currentBranch = branches.find(branch => branch.is_current);

    // Fetch branches when repository changes
    useEffect(() => {
        if (activeRepository?.id) {
            fetchBranches();
        } else {
            setBranches([]);
        }
    }, [activeRepository?.id]);

    const fetchBranches = async () => {
        if (!activeRepository?.id) return;

        setIsLoading(true);
        try {
            const response = await axios.get(`/api/v1/repositories/${activeRepository.id}/branches/`);
            setBranches(response.data.branches || []);
        } catch (error) {
            console.error('Failed to fetch branches:', error);
            toast.error('Failed to load branches');
            setBranches([]);
        } finally {
            setIsLoading(false);
        }
    }; const handleBranchSwitch = async (branchName: string) => {
        if (!activeRepository?.id || branchName === currentBranch?.name) {
            setOpen(false);
            return;
        }

        setIsSwitching(true);
        try {
            await axios.post(`/api/v1/repositories/${activeRepository.id}/switch-branch/`, {
                branch_name: branchName
            });

            toast.success(`Switched to branch: ${branchName}`);

            // Refresh branches to update current branch indicator
            await fetchBranches();
            setOpen(false);

            // Optionally reload the page to refresh repository data
            window.location.reload();

        } catch (error: any) {
            console.error('Failed to switch branch:', error);
            const errorMessage = error.response?.data?.error || 'Failed to switch branch';
            toast.error(errorMessage);
        } finally {
            setIsSwitching(false);
        }
    };

    // Don't show branch selector if no repository is selected or it's not a GitHub repo
    if (!activeRepository || activeRepository.repository_type !== 'github') {
        return null;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    role="combobox"
                    aria-expanded={open}
                    className="h-8 justify-between min-w-[140px] px-3 font-mono text-sm"
                    disabled={isLoading || isSwitching}
                >
                    <div className="flex items-center">
                        <GitBranch className="mr-2 h-3 w-3" />
                        {isLoading ? (
                            <span className="text-muted-foreground">Loading...</span>
                        ) : currentBranch ? (
                            <span className="truncate">{currentBranch.name}</span>
                        ) : (
                            <span className="text-muted-foreground">Select branch</span>
                        )}
                    </div>
                    {(isLoading || isSwitching) ? (
                        <Loader2 className="ml-2 h-3 w-3 animate-spin" />
                    ) : (
                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search branches..." className="h-8" />
                    <CommandEmpty>No branches found.</CommandEmpty>
                    <CommandGroup className="max-h-[300px] overflow-y-auto">
                        <CommandList>
                            {branches.map((branch) => (
                                <CommandItem
                                    key={branch.name}
                                    value={branch.name}
                                    onSelect={() => handleBranchSwitch(branch.name)}
                                    className="px-3 py-2"
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center">
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    branch.is_current ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <div className="flex flex-col">
                                                <div className="flex items-center">
                                                    <span className="font-mono text-sm">{branch.name}</span>
                                                    {branch.is_default && (
                                                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                                            default
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs text-muted-foreground truncate">
                                                    {branch.commit_message.substring(0, 50)}
                                                    {branch.commit_message.length > 50 ? '...' : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandList>
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
