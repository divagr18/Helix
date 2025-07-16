// src/pages/modes/IntelligenceViewPage.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefactoringDashboard } from '@/components/intelligence/RefactoringDashboard';
import { OrphansDashboard } from '@/components/intelligence/OrphanDashboard';

export const IntelligenceViewPage = () => {
  return (
    // Fixed: Use h-screen and overflow-hidden to prevent page expansion
    <div className="h-screen max-h-screen overflow-hidden flex flex-col">
      <Tabs defaultValue="refactoring" className="flex-grow flex flex-col overflow-hidden">
        {/* Header - Fixed height, no scrolling */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          {/* Left Side: Title and Description */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Intelligence Dashboard</h1>
            <p className="text-muted-foreground text-sm">
              High-level analysis and insights for the active repository.
            </p>
          </div>
          {/* Right Side: The Tabs List */}
          <div>
            <TabsList>
              <TabsTrigger value="refactoring">Refactoring</TabsTrigger>
              <TabsTrigger value="documentation">Documentation</TabsTrigger>
              <TabsTrigger value="orphans">Orphans</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Content area - fills remaining space with proper constraints */}
        <div className="flex-grow min-h-0 overflow-hidden">
          {/* Remove overflow-y-auto and p-6 from here, let individual tabs handle their own overflow */}
          <TabsContent value="refactoring" className="h-full p-6 overflow-hidden">
            <RefactoringDashboard />
          </TabsContent>
          <TabsContent value="documentation" className="h-full p-6 overflow-hidden">
            {/* Documentation content */}
          </TabsContent>
          <TabsContent value="orphans" className="h-full p-6 overflow-hidden">
            <OrphansDashboard />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};