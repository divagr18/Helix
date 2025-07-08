// src/pages/modes/IntelligenceViewPage.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefactoringDashboard } from '@/components/intelligence/RefactoringDashboard';
import { Header } from '@/components/Header'; // Assuming a shared header
import { OrphansDashboard } from '@/components/intelligence/OrphanDashboard';

export const IntelligenceViewPage = () => {
  // The header is gone. This component is now much simpler.
  return (
    <div className="h-full flex flex-col p-6">
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Intelligence Dashboard</h1>
        <p className="text-muted-foreground">
          High-level analysis and insights for the active repository.
        </p>
      </div>

      {/* Tabbed Interface for different reports */}
      <Tabs defaultValue="refactoring" className="flex-grow flex flex-col">
        <TabsList className="mb-4 self-start">
          <TabsTrigger value="refactoring">Refactoring Opportunities</TabsTrigger>
          <TabsTrigger value="documentation">Documentation Health</TabsTrigger>
          <TabsTrigger value="orphans">Orphans & Dead Code</TabsTrigger>
        </TabsList>
        <TabsContent value="orphans" className="flex-grow">
        <OrphansDashboard />
        </TabsContent>
        <TabsContent value="refactoring" className="flex-grow">
          <RefactoringDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};