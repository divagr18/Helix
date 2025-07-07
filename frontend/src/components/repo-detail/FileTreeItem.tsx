// src/components/repo-detail/FileTreeItem.tsx
import React, { useState, useMemo } from 'react';
import { type TreeNode } from '@/utils/tree';
import { type CodeFile } from '@/types';
import { Folder, File as FileIcon, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFileIdsFromNode } from '@/utils/tree';
import { useRepo } from '@/contexts/RepoContext';

interface FileTreeItemProps {
    node: TreeNode;
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({ node }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Consume state directly from the context
    const {
        selectedFile,
        setSelectedFile,
        selectedFilesForBatch,
        toggleFileForBatch,
        // We'll add task status consumption later
    } = useRepo();

    const isFolder = node.type === 'folder';
    const isFile = node.type === 'file' && node.file;

    const isSelectedForView = isFile && selectedFile?.id === node.file.id;
    const isSelectedForBatch = isFile && selectedFilesForBatch.has(node.file.id);

    // --- Logic for Folder Checkbox State ---
    const descendantFileIds = useMemo(() => isFolder ? getFileIdsFromNode(node) : [], [node, isFolder]);
    const selectedDescendantCount = useMemo(() => descendantFileIds.filter(id => selectedFilesForBatch.has(id)).length, [descendantFileIds, selectedFilesForBatch]);
    const folderCheckboxState: boolean | 'indeterminate' = useMemo(() => {
        if (!isFolder || descendantFileIds.length === 0) return false;
        if (selectedDescendantCount === 0) return false;
        if (selectedDescendantCount === descendantFileIds.length) return true;
        return 'indeterminate';
    }, [isFolder, selectedDescendantCount, descendantFileIds.length]);

    const handleNodeClick = () => {
        if (isFolder) setIsOpen(!isOpen);
        else if (node.file) setSelectedFile(node.file);
    };

    const handleFolderCheckboxChange = (checked: boolean) => {
        const newSelected = new Set(selectedFilesForBatch);
        if (checked) {
            descendantFileIds.forEach(id => newSelected.add(id));
        } else {
            descendantFileIds.forEach(id => newSelected.delete(id));
        }
        // This needs a new context function: setMultipleBatchFiles(newSet)
        // For now, we'll just log it. We will add this to the context next.
        console.log("Setting multiple files:", newSelected);
    };

    return (
        <div className="text-base">
            <div className={cn("flex items-center py-2 px-2 rounded-lg hover:bg-muted group", isSelectedForView && "bg-accent text-accent-foreground")}>
                {/* Checkbox */}
                <div className="mr-2">
                    {isFolder ? (
                        <Checkbox
                            checked={folderCheckboxState}
                            onCheckedChange={(c) => handleFolderCheckboxChange(c === true)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <Checkbox
                            checked={isSelectedForBatch}
                            onCheckedChange={() => toggleFileForBatch(node.file!.id)}
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>

                {/* Icon and Name */}
                <div className="flex items-center flex-grow truncate cursor-pointer" onClick={handleNodeClick}>
                    {isFolder && (<div onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className="p-0.5 mr-2">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>)}
                    {!isFolder && (<div className="w-[24px] mr-2"></div>)}
                    {isFolder ? <Folder size={18} className="mr-2 text-blue-400" /> : <FileIcon size={18} className="mr-2 text-muted-foreground" />}
                    <span className="truncate">{node.name}</span>
                </div>

                {/* Placeholder for status indicators and action buttons */}
            </div>

            {/* Recursive Rendering */}
            {isFolder && isOpen && (
                <div className="pl-5 border-l border-border/50 ml-[22px]">
                    {node.children?.map(child => <FileTreeItem key={child.path} node={child} />)}
                </div>
            )}
        </div>
    );
};