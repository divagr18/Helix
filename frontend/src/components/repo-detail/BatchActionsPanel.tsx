// src/components/repo-detail/BatchActionsPanel.tsx
import React from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { Button } from '@/components/ui/button';
import { Bot, GitPullRequest, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export const BatchActionsPanel = () => {
  const {
    selectedFilesForBatch,
    handleBatchGenerateDocs,
    handleBatchCreatePR,
    activeDocGenTaskId,
    activePRCreationTaskId,
    taskStatuses,
  } = useRepo();

  const isAnyBatchActionInProgress = activeDocGenTaskId !== null || activePRCreationTaskId !== null;
  const activeTaskId = activeDocGenTaskId || activePRCreationTaskId;
  const currentTaskStatus = activeTaskId ? taskStatuses[activeTaskId] : null;

  // --- NEW: Logic to render the final result ---
  const renderTaskStatus = () => {
    if (!currentTaskStatus) return null;

    // State: Task is running
    if (currentTaskStatus.status === 'PENDING' || currentTaskStatus.status === 'IN_PROGRESS') {
      return (
        <div className="text-xs text-muted-foreground text-center p-2 bg-muted rounded-md space-y-1.5">
          <p className="font-semibold truncate">{currentTaskStatus.message || "Processing..."}</p>
          <Progress value={currentTaskStatus.progress || 0} className="h-1.5" />
        </div>
      );
    }

    // State: Task succeeded
    if (currentTaskStatus.status === 'SUCCESS') {
      const prUrl = currentTaskStatus.result_data?.pr_url;
      return (
        <div className="text-xs text-center p-2 bg-green-500/10 text-green-700 dark:text-green-400 rounded-md space-y-1.5">
          <div className="flex items-center justify-center gap-2 font-semibold">
            <p>Success!</p>
          </div>
          {prUrl ? (
            <a
              href={prUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 hover:underline"
            >
              View Pull Request <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <p>{currentTaskStatus.message || "Operation completed."}</p>
          )}
        </div>
      );
    }

    // State: Task failed (implicitly) - you could add an explicit check for 'FAILURE'
    return null; // Or render an error state
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Button
          onClick={handleBatchGenerateDocs}
          disabled={isAnyBatchActionInProgress || selectedFilesForBatch.size === 0}
          className="w-full"
        >
          {activeDocGenTaskId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
          Generate Docs ({selectedFilesForBatch.size})
        </Button>
        <Button
          onClick={handleBatchCreatePR}
          disabled={isAnyBatchActionInProgress || selectedFilesForBatch.size === 0}
          className="w-full"
        >
          {activePRCreationTaskId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitPullRequest className="mr-2 h-4 w-4" />}
          Create PR ({selectedFilesForBatch.size})
        </Button>
      </div>

      {/* Render the status block */}
      {renderTaskStatus()}
    </div>
  );
};