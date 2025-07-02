// src/components/repo-detail/FileTreeItem.tsx
import React, { useState, useMemo } from 'react';
import { type TreeNode } from '@/utils/tree';
import { type CodeFile } from '@/types';
import { Folder, File as FileIcon, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFileIdsFromNode } from '@/utils/tree';

interface FileTreeItemProps {
    node: TreeNode;
    selectedFilePath: string | null;
    onFileSelect: (file: CodeFile) => void;

    // Batch selection props
    selectedFilesForBatch: Set<number>;
    onBatchSelectionChange: (fileId: number, isSelected: boolean) => void;
    onMultipleBatchSelectionChange: (newSelected: Set<number>) => void;

    // Action-related props
    batchProcessingFileId: number | null;
    creatingPRFileId: number | null;
    batchMessages: Record<number, string>;
    prMessages: Record<number, string>;
    isAnyGlobalProcessing: boolean;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({
    node,
    selectedFilePath,
    onFileSelect,
    selectedFilesForBatch,
    onBatchSelectionChange,
    onMultipleBatchSelectionChange,
    batchProcessingFileId,
    creatingPRFileId,
    batchMessages,
    prMessages,
    isAnyGlobalProcessing,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const isFolder = node.type === 'folder';
    const isFile = node.type === 'file' && node.file;

    const isSelectedForView = isFile && selectedFilePath === node.path;
    const isSelectedForBatch = isFile && selectedFilesForBatch.has(node.file.id);

    const currentlyProcessingFileId = batchProcessingFileId || creatingPRFileId;
    const isProcessingThisFile = !!(isFile && node.file.id === currentlyProcessingFileId);
    const messageForThisFile = isFile ? (batchMessages[node.file.id] || prMessages[node.file.id] || null) : null;

    // --- Logic for Folder Checkbox State ---
    const descendantFileIds = useMemo(() =>
        isFolder ? getFileIdsFromNode(node) : [],
        [node, isFolder]
    );

    const selectedDescendantCount = useMemo(() =>
        descendantFileIds.filter(id => selectedFilesForBatch.has(id)).length,
        [descendantFileIds, selectedFilesForBatch]
    );

    const folderCheckboxState: boolean | 'indeterminate' = useMemo(() => {
        if (!isFolder || descendantFileIds.length === 0) return false;
        if (selectedDescendantCount === 0) return false;
        if (selectedDescendantCount === descendantFileIds.length) return true;
        return 'indeterminate';
    }, [isFolder, selectedDescendantCount, descendantFileIds.length]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) setIsOpen(!isOpen);
    };

    const handleNodeClick = () => {
        if (isFolder) {
            setIsOpen(!isOpen);
        } else if (node.file) {
            onFileSelect(node.file);
        }
    };

    const handleFolderCheckboxChange = (checked: boolean | 'indeterminate') => {
        const newSelected = new Set(selectedFilesForBatch);
        if (checked === true) {
            descendantFileIds.forEach(id => newSelected.add(id));
        } else {
            descendantFileIds.forEach(id => newSelected.delete(id));
        }
        onMultipleBatchSelectionChange(newSelected);
    };

    return (
        <div className="text-base"> {/* Increased base text size */}
            <div
                className={cn(
                    "flex items-center py-2 px-2 rounded-lg hover:bg-muted group",
                    isSelectedForView && "bg-accent text-accent-foreground"
                )}
            >
                {/* Checkbox for both files and folders */}
                <div className="mr-2">
                    {isFolder ? (
                        <Checkbox
                            id={`folder-batch-${node.path}`}
                            checked={folderCheckboxState}
                            onCheckedChange={handleFolderCheckboxChange}
                            disabled={isAnyGlobalProcessing}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <Checkbox
                            id={`file-batch-${node.file?.id}`}
                            checked={isSelectedForBatch}
                            onCheckedChange={(checked) => onBatchSelectionChange(node.file!.id, !!checked)}
                            disabled={isAnyGlobalProcessing || isProcessingThisFile}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>

                {/* File/Folder Icon and Name */}
                <div
                    className="flex items-center flex-grow truncate cursor-pointer"
                    onClick={handleNodeClick}
                >
                    {isFolder ? (
                        <div onClick={handleToggle} className="p-0.5 mr-2">
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                    ) : (
                        <div className="w-[24px] mr-2"></div>
                    )}

                    {isFolder ? <Folder size={18} className="mr-2 text-blue-400 flex-shrink-0" /> : <FileIcon size={18} className="mr-2 text-muted-foreground flex-shrink-0" />}

                    <span className="truncate" title={node.name}>{node.name}</span>
                </div>

                {/* Status Indicator for Files */}
                {isFile && (isProcessingThisFile || messageForThisFile) && (
                    <div className="ml-2 flex items-center text-xs text-muted-foreground">
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger>
                                    {isProcessingThisFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="truncate max-w-[100px]">{messageForThisFile}</span>}
                                </TooltipTrigger>
                                <TooltipContent><p>{messageForThisFile}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                )}
            </div>

            {/* Recursive Rendering for Folders */}
            {isFolder && isOpen && (
                <div className="pl-5 border-l border-border/50 ml-[22px]">
                    {node.children?.map(child => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            selectedFilePath={selectedFilePath}
                            onFileSelect={onFileSelect}
                            selectedFilesForBatch={selectedFilesForBatch}
                            onBatchSelectionChange={onBatchSelectionChange}
                            onMultipleBatchSelectionChange={onMultipleBatchSelectionChange}
                            batchProcessingFileId={batchProcessingFileId}
                            creatingPRFileId={creatingPRFileId}
                            batchMessages={batchMessages}
                            prMessages={prMessages}
                            isAnyGlobalProcessing={isAnyGlobalProcessing}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};