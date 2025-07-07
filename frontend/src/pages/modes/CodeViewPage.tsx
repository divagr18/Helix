// src/pages/modes/CodeViewPage.tsx
import React from 'react';
import { RepoProvider } from '@/contexts/RepoContext';
import { CommandNavigationPanel } from '@/components/layout/CommandNavigationPanel';
import { ContentAnalysisPanel } from '@/components/layout/ContentAnalysisPanel';
import { IntelligenceActionPanel } from '@/components/layout/IntelligenceActionPanel';

const CodeViewInternal = () => {
    // This component exists so that it's rendered inside the RepoProvider's context
    return (
        <div className="grid grid-cols-[auto_1fr_auto] h-full overflow-hidden">
            {/* Column 1: Navigation */}
            <CommandNavigationPanel />

            {/* Column 2: Main Content */}
            <ContentAnalysisPanel />

            {/* Column 3: Intelligence */}
            <IntelligenceActionPanel />
        </div>
    );
};

export const CodeViewPage = () => {
    // The RepoProvider must wrap the component that will use its context.
    // This ensures that the `useParams` hook inside the provider can get the `repoId`.
    return (
        <RepoProvider>
            <CodeViewInternal />
        </RepoProvider>
    );
};