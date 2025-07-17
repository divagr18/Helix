// src/components/testing/CoverageFileTreeItem.tsx
import React, { useState } from 'react';
import { type TreeNode } from '@/utils/tree';
import { Folder, File as FileIcon, ChevronRight, ChevronDown, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Define the shape of the coverage data we expect for each path
interface CoverageData {
    [path: string]: {
        line_rate: number;
        // We can add more properties here later if needed
    };
}

interface CoverageFileTreeItemProps {
    node: TreeNode;
    onSelect: (node: TreeNode) => void;
    selectedPath: string | null;
    coverageData: CoverageData;
}

// Helper to determine badge color based on coverage percentage
const getCoverageBadgeVariant = (coverage: number): "default" | "secondary" | "destructive" => {
    if (coverage >= 80) return "default"; // Green (or your theme's primary success color)
    if (coverage >= 50) return "secondary"; // Yellow/Orange
    return "destructive"; // Red
};

export const CoverageFileTreeItem: React.FC<CoverageFileTreeItemProps> = ({
    node,
    onSelect,
    selectedPath,
    coverageData,
}) => {
    const [isOpen, setIsOpen] = useState(true);
    const isFolder = node.type === 'folder';
    const isSelected = selectedPath === node.path;
    const coverageInfo = coverageData[node.path];
    const coveragePercent = coverageInfo ? coverageInfo.line_rate * 100 : null;

    const handleRowClick = () => {
        onSelect(node);
        if (isFolder) setIsOpen(prev => !prev);
    };

    const handleToggleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isFolder) setIsOpen(prev => !prev);
    };

    return (
        <div>
            <div
                className={cn(
                    "flex items-center px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors",
                    isSelected
                        ? "bg-blue-600/20 text-blue-400"
                        : "text-zinc-300 hover:bg-zinc-800/60"
                )}
                onClick={handleRowClick}
            >
                {isFolder ? (
                    <div onClick={handleToggleClick} className="mr-1 p-0.5">
                        {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                    </div>
                ) : (
                    <div className="w-4 mr-1.5"></div> // Placeholder for alignment
                )}

                {isFolder ? (
                    isOpen ? <FolderOpen className="w-3.5 h-3.5 mr-2 text-zinc-500" /> : <Folder className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                ) : (
                    <FileIcon className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                )}

                <span className="truncate font-mono flex-grow">{node.name}</span>

                {coveragePercent !== null && (
                    <Badge variant={getCoverageBadgeVariant(coveragePercent)} className="ml-2 flex-shrink-0 text-xs font-mono">
                        {coveragePercent.toFixed(1)}%
                    </Badge>
                )}
            </div>

            {isFolder && isOpen && (
                <div className="pl-4">
                    {node.children?.map(child => (
                        <CoverageFileTreeItem
                            key={child.path}
                            node={child}
                            onSelect={onSelect}
                            selectedPath={selectedPath}
                            coverageData={coverageData}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};