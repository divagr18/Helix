// src/components/layout/RepoSelector.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { type Repository } from '@/types';
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const RepoSelector = () => {
  const [open, setOpen] = useState(false);
  const [repos, setRepos] = useState<Pick<Repository, 'id' | 'full_name'>[]>([]);
  const { activeRepository, setActiveRepository } = useWorkspaceStore();
  const navigate = useNavigate();
  const location = useLocation(); 
  const getCurrentMode = (): string => {
    // Example path: /repository/123/intelligence
    const pathParts = location.pathname.split('/');
    // The mode is typically the 4th part of the path (index 3)
    // ['', 'repository', '123', 'intelligence']
    if (pathParts.length >= 4 && pathParts[1] === 'repository') {
      return pathParts[3];
    }
    // Default to 'code' if we can't determine the mode
    return 'code';
  };// <--- 2. Get the current location object


  useEffect(() => {
    // Fetch the list of repositories for the dropdown
    axios.get('/api/v1/repo-selector-list/')
      .then(response => setRepos(response.data))
      .catch(err => console.error("Failed to fetch repository list", err));
  }, []);

  const handleSelectRepo = (repo: Pick<Repository, 'id' | 'full_name'>) => {
    setActiveRepository(repo as Repository);
    setOpen(false);

    // --- 4. Build the new URL dynamically ---
    const currentMode = getCurrentMode();
    const newPath = `/repository/${repo.id}/${currentMode}`;
    
    navigate(newPath);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between"
        >
          <span className="truncate">
            {activeRepository ? activeRepository.full_name : "Select a repository..."}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search repository..." />
          <CommandList>
            <CommandEmpty>No repository found.</CommandEmpty>
            <CommandGroup>
              {repos.map((repo) => (
                <CommandItem
                  key={repo.id}
                  value={repo.full_name}
                  onSelect={() => handleSelectRepo(repo)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      activeRepository?.id === repo.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {repo.full_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};