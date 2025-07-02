// src/components/repo-detail/FileTreePanel.tsx
import React, { useMemo } from 'react';
import { FileTreeHeader } from './FileTreeHeader';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type Repository, type CodeFile } from '@/types';
import { buildFileTreeFromCodeFiles } from '@/utils/tree';
import { FileTreeItem } from './FileTreeItem';

interface FileTreePanelProps {
  repo: Repository | null;
  selectedFile: CodeFile | null;
  onFileSelect: (file: CodeFile) => void;
  selectedFilesForBatch: Set<number>;
  onSelectedFilesForBatchChange: (newSelected: Set<number>) => void;
  batchProcessingFileId: number | null;
  batchMessages: Record<number, string>;
  creatingPRFileId: number | null;
  prMessages: Record<number, string>;
  isAnyOperationInProgress: boolean;
}

export const FileTreePanel: React.FC<FileTreePanelProps> = ({
  repo,
  selectedFile,
  onFileSelect,
  selectedFilesForBatch,
  onSelectedFilesForBatchChange,
  batchProcessingFileId,
  batchMessages,
  creatingPRFileId,
  prMessages,
  isAnyOperationInProgress,
}) => {
  if (!repo) return null;

  const fileTree = useMemo(() => {
    return buildFileTreeFromCodeFiles(repo.files);
  }, [repo.files]);

  const allFilesSelected = repo.files.length > 0 && selectedFilesForBatch.size === repo.files.length;

  const handleSelectAllChange = (checked: boolean | 'indeterminate') => {
    if (checked === true) {
      onSelectedFilesForBatchChange(new Set(repo.files.map(f => f.id)));
    } else {
      onSelectedFilesForBatchChange(new Set());
    }
  };

  const handleFileBatchSelectionChange = (fileId: number, isSelected: boolean) => {
    const newSelected = new Set(selectedFilesForBatch);
    isSelected ? newSelected.add(fileId) : newSelected.delete(fileId);
    onSelectedFilesForBatchChange(newSelected);
  };

  return (
    <div className="flex flex-col h-full">
      <FileTreeHeader repoFullName={repo.full_name} />

      {repo.files.length > 0 && (
        <div className="p-2.5 md:p-3 border-b border-border flex items-center space-x-3">
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

      <ScrollArea className="flex-grow p-2 md:p-3">
        {fileTree.length > 0 ? (
          <div className="space-y-1">
            {fileTree.map(node => (
              <FileTreeItem
                key={node.path}
                node={node}
                selectedFilePath={selectedFile?.file_path || null}
                onFileSelect={onFileSelect}
                selectedFilesForBatch={selectedFilesForBatch}
                onBatchSelectionChange={handleFileBatchSelectionChange}
                onMultipleBatchSelectionChange={onSelectedFilesForBatchChange}
                batchProcessingFileId={batchProcessingFileId}
                creatingPRFileId={creatingPRFileId}
                batchMessages={batchMessages}
                prMessages={prMessages}
                isAnyGlobalProcessing={isAnyOperationInProgress}
              />
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground text-center">No files found in this repository.</p>
        )}
      </ScrollArea>
    </div>
  );
};