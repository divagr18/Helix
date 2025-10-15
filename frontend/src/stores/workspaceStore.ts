// src/stores/workspaceStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Repository, type Organization } from '@/types'; // Assuming you have these types

interface WorkspaceState {
    workspaces: Organization[];
    setWorkspaces: (workspaces: Organization[]) => void;
    activeWorkspace: Organization | null;
    setActiveWorkspace: (workspace: Organization | null) => void;

    // --- NEW STATE AND ACTION ---
    activeRepository: Repository | null;
    setActiveRepository: (repository: Repository | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set) => ({
            workspaces: [],
            setWorkspaces: (workspaces) => set({ workspaces }),
            activeWorkspace: null,
            setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace, activeRepository: null }), // Also reset active repo when workspace changes

            // --- NEW STATE AND ACTION IMPLEMENTATION ---
            activeRepository: null,
            setActiveRepository: (repository) => set({ activeRepository: repository }),
        }),
        {
            name: 'helix-workspace-storage',
            // Only persist parts of the state that are safe and useful to persist
            partialize: (state) => ({
                activeWorkspace: state.activeWorkspace,
                // We don't persist the activeRepository because it contains a lot of data
                // and should be re-fetched or re-set on page load.
            }),
        }
    )
);