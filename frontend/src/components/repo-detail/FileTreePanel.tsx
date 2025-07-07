// src/components/repo-detail/FileTreePanel.tsx
import React, { useMemo } from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { buildFileTreeFromCodeFiles } from '@/utils/tree';
import { FileTreeItem } from './FileTreeItem';

export const FileTreePanel = () => {
  const { repo, selectedFilesForBatch, toggleAllFilesForBatch } = useRepo();

  const fileTree = useMemo(() => {
    if (!repo?.files) return [];
    return buildFileTreeFromCodeFiles(repo.files);
  }, [repo?.files]);

  if (!repo) return null;

  const allFilesSelected = repo.files.length > 0 && selectedFilesForBatch.size === repo.files.length;

  return (
    <div className="flex flex-col h-full">
      {/* Select All Checkbox Area */}
      <div className="p-3 border-b border-border flex items-center space-x-3 flex-shrink-0">
        <Checkbox
          id="selectAllFilesCheckbox"
          checked={allFilesSelected || (selectedFilesForBatch.size > 0 && !allFilesSelected ? "indeterminate" : false)}
          onCheckedChange={toggleAllFilesForBatch}
        />
        <Label htmlFor="selectAllFilesCheckbox" className="text-sm font-medium">
          Select All ({selectedFilesForBatch.size}/{repo.files.length})
        </Label>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-grow p-2">
        <div className="space-y-1">
          {fileTree.map(node => <FileTreeItem key={node.path} node={node} />)}
        </div>
      </ScrollArea>
    </div>
  );
};