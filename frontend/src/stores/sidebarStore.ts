// src/stores/sidebarStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
    isOpen: boolean;
    toggleSidebar: () => void;
    setIsOpen: (isOpen: boolean) => void;
}

export const useSidebarStore = create<SidebarState>()(
    persist(
        (set) => ({
            isOpen: true, // Default to open
            toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
            setIsOpen: (isOpen) => set({ isOpen }),
        }),
        {
            name: 'helix-sidebar-storage', // Name for localStorage
        }
    )
);