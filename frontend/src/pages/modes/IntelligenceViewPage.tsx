// src/pages/modes/IntelligenceViewPage.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefactoringDashboard } from '@/components/intelligence/RefactoringDashboard';
import { OrphansDashboard } from '@/components/intelligence/OrphanDashboard';

export const IntelligenceViewPage = () => {
  return (
    // Use a flex-col layout for the entire page
    <div className="h-full flex flex-col">
      <Tabs defaultValue="refactoring" className="flex-grow flex flex-col">
        {/* --- NEW HEADER STRUCTURE --- */}
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
        {/* --- END NEW HEADER STRUCTURE --- */}

        {/* The content for each tab will fill the remaining space */}
        <div className="flex-grow p-6 overflow-y-auto">
          <TabsContent value="refactoring">
            <RefactoringDashboard />
          </TabsContent>
          <TabsContent value="documentation">
          </TabsContent>
          <TabsContent value="orphans">
            <OrphansDashboard />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};