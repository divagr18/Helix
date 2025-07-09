// src/pages/modes/TestingViewPage.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CoverageDashboard } from '@/components/testing/CoverageDashboard'; // 1. Import the new dashboard component
import { TestGenerationDashboard } from '@/components/testing/TestGenerationDashboard';

export const TestingViewPage = () => {
    return (
        // The overall container for the "Testing" mode page
        <div className="h-full flex flex-col p-6">
            <div className="mb-6 flex-shrink-0"> {/* Don't let the header grow */}
                <h1 className="text-3xl font-bold tracking-tight mt-10 ml-4">Testing Dashboard</h1>
                <p className="text-muted-foreground ml-4 mt-2">
                    Analyze test coverage, results, and generate new test cases for the active repository.
                </p>
            </div>

            {/* Tabbed Interface */}
            <div className="flex-grow flex flex-col px-2 pb-6 min-h-0">
                <Tabs defaultValue="coverage" className="flex-grow flex flex-col min-h-0">
                    <TabsList className="mb-4 self-start font-plex-sans">
                        <TabsTrigger value="coverage" className="rounded-none px-4 py-4">Coverage Analysis</TabsTrigger>
                        <TabsTrigger value="generation" className="rounded-none px-4 py-4">Test Generation</TabsTrigger>
                        <TabsTrigger value="results" className="rounded-none px-4 py-4" disabled>Test Results</TabsTrigger>
                    </TabsList>

                    {/* --- THIS IS THE FIX --- */}
                    {/* Replace the placeholder with the real dashboard component */}
                    <TabsContent value="coverage" className="flex-grow min-h-0">
                        <CoverageDashboard />
                    </TabsContent>
                    {/* --- END FIX --- */}

                    <TabsContent value="generation" className="flex-grow min-h-0">
                        <TestGenerationDashboard />
                    </TabsContent>
                    <TabsContent value="results">
                        {/* Placeholder for the Test Results feature */}
                        <p>Test Results dashboard will go here.</p>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};