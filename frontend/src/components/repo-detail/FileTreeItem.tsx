import React, { useState, useMemo } from 'react';
import { type TreeNode } from '@/utils/tree';
import { Folder, File as FileIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { getFileIdsFromNode } from '@/utils/tree';
import { useRepo } from '@/contexts/RepoContext';

interface FileTreeItemProps { node: TreeNode; isBatchSelected?: boolean; }

export const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, isBatchSelected }) => {
    const [isOpen, setIsOpen] = useState(false);
    const {
        selectedFile,
        setSelectedFile,
        selectedFolderPath,
        setSelectedFolderPath,
        selectedFilesForBatch,
        toggleFileForBatch,
        setBatchSelection,
    } = useRepo();

    const isFolder = node.type === 'folder';
    const isFile = node.type === 'file';

    // Only view-selected rows are highlighted
    const isSelectedForView =
        (isFile && selectedFile?.id === node.file?.id) ||
        (isFolder && selectedFolderPath === node.path) ||
        (node.isVirtual && selectedFile === null && selectedFolderPath === null);

    const descendantFileIds = useMemo(() => (isFolder ? getFileIdsFromNode(node) : []), [node, isFolder]);
    const selectedDescendantCount = useMemo(
        () => descendantFileIds.filter(id => selectedFilesForBatch.has(id)).length,
        [descendantFileIds, selectedFilesForBatch]
    );
    const folderCheckboxState: boolean | 'indeterminate' = useMemo(() => {
        if (!isFolder || descendantFileIds.length === 0) return false;
        if (selectedDescendantCount === 0) return false;
        if (selectedDescendantCount === descendantFileIds.length) return true;
        return 'indeterminate';
    }, [isFolder, selectedDescendantCount, descendantFileIds.length]);

    const handleNodeClick = () => {
        if (isFolder) { setSelectedFolderPath(node.path); setIsOpen(!isOpen); }
        else if (node.file) setSelectedFile(node.file);
        else if (node.isVirtual && node.path === 'README.md') { setSelectedFile(null); setSelectedFolderPath(null); }
    };

    const handleFolderCheckboxChange = (checked: boolean) => {
        const newSelected = new Set(selectedFilesForBatch);
        getFileIdsFromNode(node).forEach(id => checked ? newSelected.add(id) : newSelected.delete(id));
        setBatchSelection(newSelected);
    };

    return (
        <>
            <div
                className={cn(
                    'flex items-center py-2 px-2 rounded-lg',
                    isSelectedForView ? 'bg-gray-700 text-white' : 'hover:bg-muted'
                )}
            >
                <div className="mr-2">
                    {isFolder ? (
                        <Checkbox
                            checked={folderCheckboxState}
                            onCheckedChange={c => handleFolderCheckboxChange(c === true)}
                            onClick={e => e.stopPropagation()}
                            className={isSelectedForView ? 'accent-black' : ''}
                        />
                    ) : isFile && node.file ? (
                        <Checkbox
                            checked={isBatchSelected}
                            onCheckedChange={() => toggleFileForBatch(node.file!.id)}
                            onClick={e => e.stopPropagation()}
                            className={isSelectedForView ? 'accent-black' : ''}
                        />
                    ) : (
                        <div className="w-4 h-4" />
                    )}
                </div>

                <div className="flex items-center flex-grow truncate cursor-pointer" onClick={handleNodeClick}>
                    {isFolder && (
                        <div onClick={e => { e.stopPropagation(); setIsOpen(!isOpen); }} className="p-0.5 mr-2">
                            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                    )}
                    {!isFolder && <div className="w-[24px] mr-2" />}

                    {isFolder ? <Folder size={18} className="mr-2 text-blue-400" /> : <FileIcon size={18} className="mr-2 text-muted-foreground" />}

                    <span className="truncate">{node.name}</span>
                </div>
            </div>

            {isFolder && isOpen && (
                <div className="flex flex-col space-y-1 pl-5 border-l border-border/50">
                    {node.children?.map(child => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            isBatchSelected={child.file?.id ? selectedFilesForBatch.has(child.file.id) : false}
                        />
                    ))}
                </div>
            )}
        </>
    );
};
