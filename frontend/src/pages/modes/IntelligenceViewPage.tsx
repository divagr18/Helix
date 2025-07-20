// src/pages/modes/IntelligenceViewPage.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefactoringDashboard } from '@/components/intelligence/RefactoringDashboard';
import { OrphansDashboard } from '@/components/intelligence/OrphanDashboard';
import { DocumentationReport } from "@/components/intelligence/DocumentationReport"

// A new component for the documentation report page

export const IntelligenceViewPage = () => {
  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="refactoring" className="flex-grow flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Intelligence Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">
              High-level analysis and insights for the active repository. Click on a symbol to refactor.
            </p>
          </div>

          {/* Bigger, more visible TabsList */}
          <TabsList className="bg-zinc-800 p-2 rounded-xl space-x-1">
            {[
              { value: 'refactoring', label: 'Refactoring' },
              { value: 'documentation', label: 'Documentation' },
              { value: 'orphans', label: 'Orphans' },
            ].map(({ value, label }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={`
                  text-base font-semibold text-zinc-300 
                  px-5 py-2 
                  rounded-lg 
                  transition 
                  data-[state=active]:bg-yellow-500 
                  data-[state=active]:text-zinc-900 
                  data-[state=active]:shadow-lg
                `}
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Content */}
        <div className="flex-grow min-h-0 overflow-y-auto">
          <div className="p-6 h-full"> {/* Add h-full here */}
            <TabsContent value="refactoring" className="h-full p-6 overflow-hidden">
              <RefactoringDashboard />
            </TabsContent>
            <TabsContent value="documentation" className="h-full p-6 overflow-hidden">
              <DocumentationReport />
            </TabsContent>
            <TabsContent value="orphans" className="h-full p-6 overflow-hidden">
              <OrphansDashboard />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
};
