// src/components/testing/CoverageFileTreeItem.tsx
import React, { useState } from 'react';
import { type TreeNode } from '@/utils/tree';
import { Folder, File as FileIcon, ChevronRight, ChevronDown } from 'lucide-react';
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
    const [isOpen, setIsOpen] = useState(true); // Default to open for better visibility

    const isFolder = node.type === 'folder';
    const isSelected = selectedPath === node.path;

    // Get the coverage for this specific node from the pre-calculated data
    const coverageInfo = coverageData[node.path];
    const coveragePercent = coverageInfo ? coverageInfo.line_rate * 100 : null;
    const handleRowClick = () => {
        // This console.log is your primary debugging tool.
        // If you see this, the click is being registered.
        console.log("Row clicked:", node.path);

        // Call the onSelect function passed from the parent.
        onSelect(node);

        // Also, toggle the folder state if it's a folder.
        if (isFolder) {
            setIsOpen(prev => !prev);
        }
    };
    const handleToggleClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Stop the click from bubbling up to the main div
        if (isFolder) {
            setIsOpen(prev => !prev);
        }
    };

    return (
        <div className="text-sm">
            <div
                className={cn(
                    "flex items-center py-1.5 px-2 rounded-md hover:bg-muted cursor-pointer",
                    isSelected && "bg-accent text-accent-foreground"
                )}
                onClick={handleRowClick} // Use the new, robust handler
            >
                {/* Toggle Icon with its own specific handler */}
                {isFolder ? (
                    <div onClick={handleToggleClick} className="p-0.5 mr-1 text-muted-foreground hover:text-foreground">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                ) : (
                    <div className="w-[22px]"></div>
                )}

                {/* File/Folder Icon */}
                {isFolder ? (
                    <Folder size={16} className="mr-2 text-blue-400 flex-shrink-0" />
                ) : (
                    <FileIcon size={16} className="mr-2 text-gray-400 flex-shrink-0" />
                )}

                {/* Name */}
                <span className="flex-grow truncate" title={node.name}>{node.name}</span>

                {/* Coverage Badge */}
                {coveragePercent !== null && (
                    <Badge variant={getCoverageBadgeVariant(coveragePercent)} className="ml-2 flex-shrink-0">
                        {coveragePercent.toFixed(1)}%
                    </Badge>
                )}
            </div>

            {/* Recursive Rendering for Children */}
            {isFolder && isOpen && (
                <div className="pl-4 border-l border-border/50 ml-[15px]">
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