import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type Organization } from '@/types';

interface WorkspaceState {
    workspaces: Organization[];
    activeWorkspace: Organization | null;
    setWorkspaces: (workspaces: Organization[]) => void;
    setActiveWorkspace: (workspace: Organization | null) => void;
    addWorkspace: (workspace: Organization) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
    // Use the `persist` middleware to save the active workspace
    persist(
        (set) => ({
            workspaces: [],
            activeWorkspace: null,
            setWorkspaces: (workspaces) => set({ workspaces }),
            setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
            addWorkspace: (workspace) => set((state) => ({
                workspaces: [...state.workspaces, workspace]
            })),
        }),
        {
            name: 'helix-workspace-storage', // Unique name for localStorage item
            storage: createJSONStorage(() => localStorage), // Specify localStorage
            // We only want to persist the activeWorkspace so the user returns to where they left off.
            // The full list of workspaces will be re-fetched on every app load.
            partialize: (state) => ({ activeWorkspace: state.activeWorkspace }),
        }
    )
);