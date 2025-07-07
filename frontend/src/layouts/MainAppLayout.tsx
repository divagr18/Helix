// src/layouts/MainAppLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { MasterSidebar } from '@/components/layout/MasterSidebar';

export const MainAppLayout = () => {
    return (
        // Use flexbox for the main layout. It fills the parent's height.
        <div className="flex flex-row h-full w-full">
            <MasterSidebar />

            {/* This main content area will grow to fill the remaining space */}
            <main className="flex-1 flex flex-col min-w-0"> {/* flex-1 is key, min-w-0 prevents overflow */}
                {/* The Outlet will render our "Mode" pages, which should be designed to fill this container */}
                <Outlet />
            </main>
        </div>
    );
};