// src/pages/ActivityPage.tsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { ActivityFeed } from '@/components/repo-detail/ActivityFeed'; // Import your existing component
import { Card, CardContent } from '@/components/ui/card';

export const ActivityPage = () => {
    // 1. Get the repoId from the URL parameters.
    const { repoId } = useParams<{ repoId: string }>();

    // 2. Handle the case where the ID might be missing or invalid.
    if (!repoId) {
        return (
            <div className="p-8 text-center text-destructive">
                Error: Repository ID not found in the URL.
            </div>
        );
    }

    // 3. Convert the ID from a string to a number.
    const numericRepoId = parseInt(repoId, 10);

    // 4. Render your ActivityFeed component and pass the numeric ID as a prop.
    return (
        // This outer container ensures the ResizablePanelGroup has a defined height to work with.
        <div className="h-full p-4">
            <Card className="h-full w-full">
                <CardContent className="h-full p-0">
                    <ActivityFeed repoId={numericRepoId} />
                </CardContent>
            </Card>
        </div>
    );
};