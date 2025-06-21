// src/components/repo-detail/FileTreePanel.tsx
import React from 'react';
import { Link } from 'react-router-dom'; // For Dashboard link
import { FileTreeHeader } from './FileTreeHeader';
import { FileListItem } from './FileListItem';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area'; // For better scrollbar styling
import { type Repository, type CodeFile } from '@/types'; // Assuming central types

// Props this panel will need from RepoDetailPage
interface FileTreePanelProps {
  repo: Repository | null;
  selectedFile: CodeFile | null;
  onFileSelect: (file: CodeFile) => void;
  
  selectedFilesForBatch: Set<number>;
  onSelectedFilesForBatchChange: (newSelected: Set<number>) => void; // To update the parent's state
  
  // Per-file action states and handlers
  onGenerateDocsForFile: (fileId: number, fileName: string) => void;
  batchProcessingFileId: number | null; // ID of file currently having docs generated
  batchMessages: Record<number, string>;
  
  onCreatePRForFile: (fileId: number, fileName: string) => void;
  creatingPRFileId: number | null; // ID of file currently having PR created
  prMessages: Record<number, string>;

  // Global batch operation status (to disable individual file actions if a global batch is running)
  activeGlobalDocGenTaskId: string | null; 
  activeGlobalPRCreationTaskId: string | null;
  isAnyOperationInProgress: boolean; 
}

export const FileTreePanel: React.FC<FileTreePanelProps> = ({
  repo,
  selectedFile,
  onFileSelect,
  selectedFilesForBatch,
  onSelectedFilesForBatchChange,
  onGenerateDocsForFile,
  batchProcessingFileId,
  batchMessages,
  onCreatePRForFile,
  creatingPRFileId,
  prMessages,
  isAnyOperationInProgress,
}) => {
  if (!repo) return null; // Or a loading/empty state for the panel

  const allFilesSelected = repo.files.length > 0 && selectedFilesForBatch.size === repo.files.length;
  const noFilesSelected = selectedFilesForBatch.size === 0;

  const handleSelectAllChange = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      onSelectedFilesForBatchChange(new Set(repo.files.map(f => f.id)));
    } else {
      onSelectedFilesForBatchChange(new Set());
    }
  };

  const handleFileBatchSelectionChange = (fileId: number, isSelected: boolean) => {
    const newSelected = new Set(selectedFilesForBatch);
    if (isSelected) {
      newSelected.add(fileId);
    } else {
      newSelected.delete(fileId);
    }
    onSelectedFilesForBatchChange(newSelected);
  };

  // True if any global batch operation (from BatchActionsPanel) is running OR
  // if any individual file's doc/PR action is running.

  return (
    // The parent <aside> in RepoDetailPage already handles width, flex-shrink, border, bg-card, and main overflow
    // This component focuses on the internal structure and scrolling of its content.
    <> {/* Use Fragment as the parent <aside> provides the main panel container */}
      <FileTreeHeader repoFullName={repo.full_name} />

      {/* Select All Checkbox Area */}
      {repo.files.length > 0 && (
        <div className="p-2.5 md:p-3 border-b border-border flex items-center space-x-2">
          <Checkbox
            id="selectAllFilesCheckbox"
            checked={allFilesSelected || (selectedFilesForBatch.size > 0 && !allFilesSelected ? "indeterminate" : false)}
            onCheckedChange={handleSelectAllChange}
            disabled={isAnyOperationInProgress}
            aria-label="Select all files for batch processing"
          />
          <Label htmlFor="selectAllFilesCheckbox" className="text-sm font-medium cursor-pointer select-none">
            {allFilesSelected ? 'Deselect All' : 'Select All'} 
            <span className="text-xs text-muted-foreground ml-1">
              ({selectedFilesForBatch.size}/{repo.files.length})
            </span>
          </Label>
        </div>
      )}

      {/* File List - Use shadcn/ui ScrollArea for styled scrollbars */}
      <ScrollArea className="p-1.5 md:p-2"> {/* flex-grow to take remaining space, padding for items */}
        {repo.files.length > 0 ? (
          <ul className="space-y-0.5"> {/* Small space between items */}
            {repo.files.map(file => (
              <FileListItem
                key={file.id}
                file={file}
                isSelectedForBatch={selectedFilesForBatch.has(file.id)}
                onBatchSelectionChange={handleFileBatchSelectionChange}
                isSelectedFile={selectedFile?.id === file.id}
                onFileSelect={onFileSelect}
                onGenerateDocsForFile={onGenerateDocsForFile}
                isProcessingDocsThisFile={batchProcessingFileId === file.id}
                onCreatePRForFile={onCreatePRForFile}
                isCreatingPRThisFile={creatingPRFileId === file.id}
                isAnyGlobalBatchProcessing={isAnyOperationInProgress} // Pass the comprehensive flag
                batchMessageForThisFile={batchMessages[file.id] || null}
                prMessageForThisFile={prMessages[file.id] || null}
              />
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground text-center">No files found in this repository.</p>
        )}
      </ScrollArea>
    </>
  );
};