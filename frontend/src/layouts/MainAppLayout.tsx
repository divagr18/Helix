// src/layouts/MainAppLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { GlobalHeader } from '@/components/layout/GlobalHeader';
import { MasterSidebar } from '@/components/layout/MasterSidebar';
import { RepoContextLoader } from '@/pages/modes/RepoContextLoader'; // Import the loader

export const MainAppLayout = () => {
  return (
    <div className="h-screen grid grid-rows-[auto_1fr]">
      <GlobalHeader />
      <div className="grid grid-cols-[auto_1fr] overflow-hidden">
        <MasterSidebar />
        <main className="overflow-y-auto min-h-0">
          {/* Wrap the Outlet with the RepoContextLoader */}
          <RepoContextLoader>
            <Outlet />
          </RepoContextLoader>
        </main>
      </div>
    </div>
  );
};