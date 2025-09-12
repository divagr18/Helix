"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRepo } from "@/contexts/RepoContext"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { SymbolTestGeneratorPanel } from "./SymbolTestGeneratorPanel"
import type { CodeFile } from "@/types"
import axios from "axios"
import { FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Loader2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

interface FileTreeNode {
    name: string
    path: string
    type: "file" | "folder"
    file?: CodeFile
    children: FileTreeNode[]
    isExpanded?: boolean
}

const buildFileTree = (files: CodeFile[]): FileTreeNode[] => {
    const root: FileTreeNode[] = []
    const nodeMap = new Map<string, FileTreeNode>()

    const rootNode: FileTreeNode = {
        name: "",
        path: "",
        type: "folder",
        children: [],
        isExpanded: true,
    }
    nodeMap.set("", rootNode)

    files.forEach((file) => {
        const pathParts = file.file_path.split("/")
        let currentPath = ""

        pathParts.forEach((part, index) => {
            const parentPath = currentPath
            currentPath = currentPath ? `${currentPath}/${part}` : part

            if (!nodeMap.has(currentPath)) {
                const isFile = index === pathParts.length - 1
                const node: FileTreeNode = {
                    name: part,
                    path: currentPath,
                    type: isFile ? "file" : "folder",
                    file: isFile ? file : undefined,
                    children: [],
                    isExpanded: false,
                }

                nodeMap.set(currentPath, node)

                const parentNode = nodeMap.get(parentPath)
                if (parentNode) {
                    parentNode.children.push(node)
                }
            }
        })
    })

    return rootNode.children.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === "folder" ? -1 : 1
        }
        return a.name.localeCompare(b.name)
    })
}

interface FileTreeItemProps {
    node: FileTreeNode
    selectedFile: CodeFile | null
    onFileSelect: (file: CodeFile) => void
    onToggleExpand: (path: string) => void
    level: number
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({ node, selectedFile, onFileSelect, onToggleExpand, level }) => {
    const isSelected = selectedFile?.id === node.file?.id
    const hasChildren = node.children.length > 0

    return (
        <div>
            <div
                className={`
          flex items-center px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors
          ${isSelected
                        ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                        : "text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-200"
                    }
        `}
                style={{ paddingLeft: `${8 + level * 16}px` }}
                onClick={() => {
                    if (node.type === "file" && node.file) {
                        onFileSelect(node.file)
                    } else if (node.type === "folder") {
                        onToggleExpand(node.path)
                    }
                }}
            >
                {node.type === "folder" && hasChildren && (
                    <div className="mr-1">
                        {node.isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-zinc-500" />
                        ) : (
                            <ChevronRight className="w-3 h-3 text-zinc-500" />
                        )}
                    </div>
                )}

                {node.type === "folder" ? (
                    node.isExpanded ? (
                        <FolderOpen className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                    ) : (
                        <Folder className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                    )
                ) : (
                    <FileText className="w-3.5 h-3.5 mr-2 text-zinc-500" />
                )}

                <span className="truncate font-mono">{node.name}</span>
            </div>

            {node.type === "folder" && node.isExpanded && hasChildren && (
                <div>
                    {node.children.map((child) => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            selectedFile={selectedFile}
                            onFileSelect={onFileSelect}
                            onToggleExpand={onToggleExpand}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export const TestGenerationDashboard = () => {
    const { repo } = useRepo()
    const [detailedSelectedFile, setDetailedSelectedFile] = useState<CodeFile | null>(null);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);

    const [sourceCode, setSourceCode] = useState<string | null>(null)
    const [isLoadingContent, setIsLoadingContent] = useState(false)
    const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (repo?.files) {
            const tree = buildFileTree(repo.files)
            setFileTree(tree)
            const firstLevelFolders = tree.filter((node) => node.type === "folder").map((node) => node.path)
            setExpandedFolders(new Set(firstLevelFolders))
        }
    }, [repo?.files])

    useEffect(() => {
        const updateTreeExpansion = (nodes: FileTreeNode[]): FileTreeNode[] => {
            return nodes.map((node) => ({
                ...node,
                isExpanded: expandedFolders.has(node.path),
                children: updateTreeExpansion(node.children),
            }))
        }

        setFileTree((prev) => updateTreeExpansion(prev))
    }, [expandedFolders])

    const handleFileSelect = (fileFromTree: CodeFile) => {
        // 1. Clear out old data immediately
        setDetailedSelectedFile(null);
        setSourceCode(null);
        setIsLoadingDetails(true);
        setIsLoadingContent(true);

        // 2. Fetch the FULL, detailed file object from its specific endpoint
        axios.get(`/api/v1/files/${fileFromTree.id}/`)
            .then(response => {
                // The response.data should be the complete CodeFile object
                setDetailedSelectedFile(response.data);
            })
            .catch(err => {
                console.error("Failed to fetch detailed file:", err);
                toast.error("Could not load file details.");
            })
            .finally(() => {
                setIsLoadingDetails(false);
            });

        // 3. Fetch the source code in parallel
        axios.get(`/api/v1/files/${fileFromTree.id}/content/`)
            .then((response) => {
                setSourceCode(response.data.content || response.data);
            })
            .catch(() => {
                setSourceCode("// Error: Could not load source code.");
            })
            .finally(() => {
                setIsLoadingContent(false);
            });
    };

    const handleToggleExpand = (path: string) => {
        setExpandedFolders((prev) => {
            const newSet = new Set(prev)
            if (newSet.has(path)) {
                newSet.delete(path)
            } else {
                newSet.add(path)
            }
            return newSet
        })
    }

    if (!repo) {
        return (
            <div className="flex items-center justify-center h-full bg-zinc-950">
                <p className="text-zinc-400">This repository's data is not available.</p>
            </div>
        )
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-950">
            <ResizablePanelGroup direction="horizontal" className="flex-1 flex min-h-0">
                {/* Left Panel: File Tree */}
                <ResizablePanel defaultSize={30} minSize={20} className="flex flex-col min-h-0">
                    <div className="h-full flex flex-col bg-zinc-900/50 border-r border-zinc-800/60">
                        <div className="px-4 py-3 border-b border-zinc-800/60 bg-zinc-900/30">
                            <h3 className="font-medium text-zinc-200 text-sm flex items-center">
                                <Folder className="w-4 h-4 mr-2 text-zinc-400" />
                                Select File for Testing
                            </h3>
                            <p className="text-xs text-zinc-500 mt-1">Choose a file to generate tests</p>
                        </div>
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-2 space-y-0.5 h-full overflow-y-auto">
                                {fileTree.map((node) => (
                                    <FileTreeItem
                                        key={node.path}
                                        node={node}
                                        // The visual selection is based on the detailed file's ID
                                        selectedFile={detailedSelectedFile}
                                        // The onFileSelect now calls our new handler
                                        onFileSelect={handleFileSelect}
                                        onToggleExpand={handleToggleExpand}
                                        level={0}
                                    />
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </ResizablePanel>

                <ResizableHandle className="bg-zinc-800/60 hover:bg-zinc-700/60 transition-colors" />

                {/* Right Panel: Symbol Selector and Test Display */}
                <ResizablePanel defaultSize={70} minSize={30} className="flex flex-col min-h-0">
                    <div className="h-full flex flex-col min-h-0 bg-zinc-950">
                        {/* --- RENDER LOGIC IS NOW BASED ON THE DETAILED FILE --- */}
                        {isLoadingDetails ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                            </div>
                        ) : detailedSelectedFile ? (
                            <SymbolTestGeneratorPanel
                                file={detailedSelectedFile} // Pass the full object
                                sourceCode={sourceCode}
                                isLoadingContent={isLoadingContent}
                            />
                        ) : (
                            <div className="flex items-center justify-center flex-1">
                                {/* ... (Placeholder remains the same) ... */}
                            </div>
                        )}
                    </div>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    )
}
