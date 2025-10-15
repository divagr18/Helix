// src/pages/modes/CodeViewPage.tsx
import { RepoProvider } from '@/contexts/RepoContext';
import { CommandNavigationPanel } from '@/components/layout/CommandNavigationPanel';
import { ContentAnalysisPanel } from '@/components/layout/ContentAnalysisPanel';
import { IntelligenceActionPanel } from '@/components/layout/IntelligenceActionPanel';
import { ChatButton } from '@/components/chat/ChatButton';

const CodeViewInternal = () => {
    return (
        <div className="grid grid-cols-[auto_1fr_auto] h-full overflow-hidden relative">
            {/* Column 1: Navigation */}
            <CommandNavigationPanel />

            {/* Column 2: Main Content */}
            <ContentAnalysisPanel />

            {/* Column 3: Intelligence */}
            <IntelligenceActionPanel />

            {/* Sleek Floating Chat Button */}
            <ChatButton />
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