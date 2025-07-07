// src/pages/settings/WorkspaceSettingsPage.tsx
import React from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralWorkspaceSettings } from './GeneralWorkspaceSettings'; // We will create this next
import { MembersSettingsTab } from './MembersSettingsTab';

export const WorkspaceSettingsPage = () => {
    const { activeWorkspace } = useWorkspaceStore();

    // If no workspace is selected (e.g., user has none, or still loading),
    // show a placeholder message.
    if (!activeWorkspace) {
        return (
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Workspace Settings</h2>
                <p className="text-muted-foreground mt-2">
                    Please select a workspace from the header to manage its settings.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">Workspace Settings</h2>
                <p className="text-muted-foreground">
                    Manage settings for the <span className="font-semibold text-foreground">{activeWorkspace.name}</span> workspace.
                </p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 max-w-md">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="members">Members & Invites</TabsTrigger> {/* <--- REMOVE 'disabled' */}
                </TabsList>
                <TabsContent value="general" className="mt-4">
                    <GeneralWorkspaceSettings />
                </TabsContent>
                <TabsContent value="members">
                    <MembersSettingsTab />
                </TabsContent>
                <TabsContent value="api">
                    {/* Placeholder for a future feature */}
                </TabsContent>
            </Tabs>
        </div>
    );
};