// src/components/repo-detail/BatchActionsPanel.tsx
import React from 'react';
import { Bot, GitMerge, Loader2 } from 'lucide-react'; // Or GitPullRequest, Sparkles

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress'; // Add this: npx shadcn-ui@latest add progress
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'; // Add this: npx shadcn-ui@latest add alert

interface BatchActionsPanelProps {
  selectedFileCount: number; // Instead of the whole Set, just the count for display
  
  onBatchGenerateDocs: () => void;
  activeDocGenTaskId: string | null;
  docGenTaskMessage: string | React.ReactNode | null; // Can be string or JSX (e.g. for links)
  docGenTaskProgress: number; // 0-100

  onBatchCreatePR: () => void;
  activePRCreationTaskId: string | null;
  prCreationTaskMessage: string | React.ReactNode | null;
  prCreationTaskProgress: number; // 0-100
  
  // To disable buttons if other critical operations are running
  isAnyFileSpecificActionInProgress: boolean; 
}

export const BatchActionsPanel: React.FC<BatchActionsPanelProps> = ({
  selectedFileCount,
  onBatchGenerateDocs,
  activeDocGenTaskId,
  docGenTaskMessage,
  docGenTaskProgress,
  onBatchCreatePR,
  activePRCreationTaskId,
  prCreationTaskMessage,
  prCreationTaskProgress,
  isAnyFileSpecificActionInProgress,
}) => {
  const canGenerateDocs = selectedFileCount > 0 && !activeDocGenTaskId && !activePRCreationTaskId && !isAnyFileSpecificActionInProgress;
  const canCreatePR = selectedFileCount > 0 && !activePRCreationTaskId && !activeDocGenTaskId && !isAnyFileSpecificActionInProgress;

  const getMessageVariant = (message: string | React.ReactNode | null): "default" | "destructive" => {
    if (typeof message === 'string' && (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed'))) {
      return "destructive";
    }
    return "default";
  };

  return (
    // The parent div in RepoDetailPage already provides p-3/p-4, border-t, bg-background, shadow-inner
    // This component just renders its content within that.
    <div>
      <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3 text-foreground">
        Batch Actions ({selectedFileCount} selected)
      </h3>
      <div className="space-y-3"> {/* Increased space between buttons and their messages */}
        <div>
          <Button
            onClick={onBatchGenerateDocs}
            disabled={!canGenerateDocs}
            className="w-full"
            variant="default" // Or "secondary" if you prefer
          >
            {activeDocGenTaskId ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bot className="mr-2 h-4 w-4" /> // Or Sparkles
            )}
            {activeDocGenTaskId ? `Generating Docs (${docGenTaskProgress}%)` : 'Generate Docs for Selected'}
          </Button>
          {activeDocGenTaskId && docGenTaskProgress > 0 && docGenTaskProgress < 100 && (
            <Progress value={docGenTaskProgress} className="w-full h-1.5 mt-1.5" />
          )}
          {docGenTaskMessage && (
            <Alert variant={getMessageVariant(docGenTaskMessage)} className="mt-2 text-xs p-2">
              {/* <AlertTitle>Notice</AlertTitle> // Optional title */}
              <AlertDescription>{docGenTaskMessage}</AlertDescription>
            </Alert>
          )}
        </div>

        <div>
          <Button
            onClick={onBatchCreatePR}
            disabled={!canCreatePR}
            className="w-full"
            variant="secondary" // Or "default"
          >
            {activePRCreationTaskId ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GitMerge className="mr-2 h-4 w-4" /> // Or GitPullRequest
            )}
            {activePRCreationTaskId ? `Creating PR (${prCreationTaskProgress}%)` : 'Create PR for Selected'}
          </Button>
          {activePRCreationTaskId && prCreationTaskProgress > 0 && prCreationTaskProgress < 100 && (
            <Progress value={prCreationTaskProgress} className="w-full h-1.5 mt-1.5" />
          )}
          {prCreationTaskMessage && (
            <Alert variant={getMessageVariant(prCreationTaskMessage)} className="mt-2 text-xs p-2">
              {/* <AlertTitle>Notice</AlertTitle> // Optional title */}
              <AlertDescription>{prCreationTaskMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
};