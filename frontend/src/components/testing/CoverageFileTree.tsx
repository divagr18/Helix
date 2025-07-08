// src/components/testing/CoverageFileTree.tsx
import React, { useMemo } from 'react';
import { buildFileTree, type TreeNode } from '@/utils/tree';
import { CoverageFileTreeItem } from './CoverageFileTreeItem';

interface CoverageFileTreeProps {
    report: any; // The full coverage report from the API
    onSelect: (node: TreeNode) => void;
    selectedPath: string | null;
}

// This helper function calculates coverage for folders by averaging their children
const calculateFolderCoverage = (node: TreeNode, coverageData: any) => {
    if (node.type === 'file') {
        return; // File coverage is already known
    }
    if (!node.children || node.children.length === 0) {
        return;
    }

    let totalLineRate = 0;
    let fileCount = 0;

    node.children.forEach(child => {
        calculateFolderCoverage(child, coverageData); // Recurse first
        const childCoverage = coverageData[child.path];
        if (childCoverage) {
            totalLineRate += childCoverage.line_rate;
            if (child.type === 'file') {
                fileCount += 1;
            } else {
                // For sub-folders, we need to count their files
                const countFilesInSubfolder = (subNode: TreeNode): number => {
                    if (subNode.type === 'file') return 1;
                    if (!subNode.children) return 0;
                    return subNode.children.reduce((sum, subChild) => sum + countFilesInSubfolder(subChild), 0);
                }
                fileCount += countFilesInSubfolder(child);
            }
        }
    });

    if (fileCount > 0) {
        coverageData[node.path] = {
            line_rate: totalLineRate / fileCount,
        };
    }
};

export const CoverageFileTree: React.FC<CoverageFileTreeProps> = ({ report, onSelect, selectedPath }) => {
    // Memoize the file tree structure so it's not rebuilt on every render
    const fileTree = useMemo(() => {
        if (!report?.file_coverages) return [];
        const filePaths = report.file_coverages.map((fc: any) => fc.file_path);
        return buildFileTree(filePaths);
    }, [report]);

    // Memoize the coverage data, including calculated folder coverages
    const coverageData = useMemo(() => {
        if (!report?.file_coverages) return {};

        // Start with a map of file paths to their coverage data
        const data = report.file_coverages.reduce((acc: any, fc: any) => {
            acc[fc.file_path] = { line_rate: fc.line_rate };
            return acc;
        }, {});

        // Recursively calculate and add folder coverages to the map
        fileTree.forEach(rootNode => calculateFolderCoverage(rootNode, data));

        return data;
    }, [report, fileTree]);

    return (
        <div className="p-2 space-y-1">
            {fileTree.length > 0 ? (
                fileTree.map(node => (
                    <CoverageFileTreeItem
                        key={node.path}
                        node={node}
                        onSelect={onSelect}
                        selectedPath={selectedPath}
                        coverageData={coverageData}
                    />
                ))
            ) : (
                <p className="text-xs text-muted-foreground text-center p-4">
                    No file coverage data found in this report.
                </p>
            )}
        </div>
    );
};