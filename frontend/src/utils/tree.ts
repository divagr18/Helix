// src/utils/tree.ts
import { type CodeFile } from '@/types';

export interface TreeNode {
    name: string;
    path: string;
    type: 'folder' | 'file';
    children?: TreeNode[];
    file?: CodeFile;
}

export function buildFileTreeFromCodeFiles(files: CodeFile[]): TreeNode[] {
    const root: TreeNode = { name: 'root', path: '', children: [], type: 'folder' };

    for (const file of files) {
        const path = file.file_path;
        const parts = path.split('/');
        let currentNode = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            const currentPath = parts.slice(0, i + 1).join('/');

            let childNode = currentNode.children?.find(child => child.name === part);

            if (!childNode) {
                childNode = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'folder',
                    file: isFile ? file : undefined,
                    children: isFile ? undefined : [],
                };
                currentNode.children?.push(childNode);
            }

            currentNode.children?.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
            });

            if (!isFile) {
                currentNode = childNode;
            }
        }
    }
    return root.children || [];
}

export function getFileIdsFromNode(node: TreeNode): number[] {
    let ids: number[] = [];
    if (node.type === 'file' && node.file) {
        ids.push(node.file.id);
    } else if (node.type === 'folder' && node.children) {
        for (const child of node.children) {
            ids.push(...getFileIdsFromNode(child));
        }
    }
    return ids;
}
export function buildFileTree(paths: string[]): TreeNode[] {
    const root: TreeNode = { name: 'root', path: '', children: [], type: 'folder' };

    for (const path of paths) {
        const parts = path.split('/');
        let currentNode = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            const currentPath = parts.slice(0, i + 1).join('/');

            let childNode = currentNode.children?.find(child => child.name === part);

            if (!childNode) {
                childNode = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'folder',
                    // Note: The 'file' property will be undefined because we are working from strings
                    file: undefined,
                    children: isFile ? undefined : [],
                };
                currentNode.children?.push(childNode);
            }

            // Sort children: folders first, then files, both alphabetically
            currentNode.children?.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
            });

            if (!isFile) {
                currentNode = childNode;
            }
        }
    }
    return root.children || [];
}