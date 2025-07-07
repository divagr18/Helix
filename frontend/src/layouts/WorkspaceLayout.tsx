// src/layouts/WorkspaceLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { GlobalHeader } from '@/components/layout/GlobalHeader';
import { MasterSidebar } from '@/components/layout/MasterSidebar';

export const WorkspaceLayout = () => {
    return (
        <div className="h-full grid grid-rows-[auto_1fr]">
            <GlobalHeader />
            <div className="grid grid-cols-[auto_1fr] overflow-hidden">
                <MasterSidebar />
                <main className="overflow-y-auto min-h-0">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};