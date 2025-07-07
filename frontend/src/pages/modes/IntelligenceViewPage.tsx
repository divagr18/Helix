// src/pages/modes/IntelligenceViewPage.tsx
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefactoringDashboard } from '@/components/intelligence/RefactoringDashboard';
import { Header } from '@/components/Header'; // Assuming a shared header

export const IntelligenceViewPage = () => {
    return (
        <div className="h-full flex flex-col">
            <Header /> {/* Or a dedicated header for this mode */}
            <div className="p-6">
                <h1 className="text-3xl font-bold">Intelligence Dashboard</h1>
                <p className="text-muted-foreground">High-level analysis and insights for your repositories.</p>
            </div>
            <Tabs defaultValue="refactoring" className="flex-grow flex flex-col p-6 pt-0">
                <TabsList className="mb-4">
                    <TabsTrigger value="refactoring">Refactoring Opportunities</TabsTrigger>
                    <TabsTrigger value="documentation" disabled>Documentation Health</TabsTrigger>
                    <TabsTrigger value="orphans" disabled>Orphans & Dead Code</TabsTrigger>
                </TabsList>
                <TabsContent value="refactoring" className="flex-grow">
                    <RefactoringDashboard />
                </TabsContent>
                {/* Other TabsContent will go here later */}
            </Tabs>
        </div>
    );
};