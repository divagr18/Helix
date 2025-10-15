import React from 'react'
import { Outlet } from 'react-router-dom'
import { GlobalHeader } from '@/components/layout/GlobalHeader'
import { MasterSidebar } from '@/components/layout/MasterSidebar'

export const MainAppLayout = () => {
  return (
    // Full-screen grid with header and content
    <div className="h-screen grid grid-rows-[auto_1fr]">
      <GlobalHeader />
      <div className="grid grid-cols-[auto_1fr] overflow-hidden">
        <MasterSidebar />
        {/* Make main a flex container so child routes can stretch */}
        <main className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {/* RepoContextLoader now in Outlet component */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// Ensure html, body, #root have full height in your global CSS:
// html, body, #root { height: 100%; }
