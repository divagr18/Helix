// src/components/testing/TestGenerationDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { FileTreePanel } from '@/components/repo-detail/FileTreePanel'; // We can reuse this!
import { SymbolTestGeneratorPanel } from './SymbolTestGeneratorPanel';
import type { CodeFile } from '@/types';
import axios from 'axios';

export const TestGenerationDashboard = () => {
    const { repo } = useRepo(); // We only need the repo object to pass to the file tree

    // This local state will track which file is selected *within this dashboard*
    const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
    const [sourceCode, setSourceCode] = useState<string | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    useEffect(() => {
        console.log("TGD: selectedFile changed to:", selectedFile?.file_path);
        if (selectedFile) {
            setIsLoadingContent(true);
            setSourceCode(null);
            axios.get(`/api/v1/files/${selectedFile.id}/content/`)
                .then(response => {
                    console.log("TGD: API call successful. Received content.");
                    setSourceCode(response.data);
                })
                .catch(err => {
                    console.error("Failed to fetch source code for test generation:", err);
                    setSourceCode("// Error: Could not load source code.");
                })
                .finally(() => {
                    setIsLoadingContent(false);
                });
        } else {
            setSourceCode(null); // Clear content if no file is selected
        }
    }, [selectedFile]);

    if (!repo) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">This repository's data is not available.</p>
            </div>
        );
    }

    return (
        <ResizablePanelGroup direction="horizontal" className="h-full border rounded-none border-[#1f1f1f] bg-card">
            {/* Left Panel: File Tree */}
            <ResizablePanel defaultSize={30} minSize={20}>
                <div className="p-2 border-r h-full flex flex-col">
                    <h3 className="font-semibold p-2 text-lg">Select a File</h3>
                    <div className="flex-grow min-h-0">
                        {/* 
              We need a slightly modified FileTreePanel that doesn't rely on the global
              selectedFile from RepoContext, but uses its own local state.
              For now, we'll create a simple list, and can refactor FileTreePanel later.
            */}
                        <div className="h-full overflow-y-auto">
                            {repo.files.map(file => (
                                <div
                                    key={file.id}
                                    onClick={() => setSelectedFile(file)}
                                    className={`p-2 rounded-md cursor-pointer text-sm ${selectedFile?.id === file.id ? 'bg-accent' : 'hover:bg-muted'}`}
                                >
                                    {file.file_path}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel: Symbol Selector and Test Display */}
            <ResizablePanel defaultSize={70} minSize={30}>
                {selectedFile ? (
                    <SymbolTestGeneratorPanel file={selectedFile} sourceCode={sourceCode} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-muted-foreground">Select a file to see its functions and methods.</p>
                    </div>
                )}
            </ResizablePanel>
        </ResizablePanelGroup>
    );
};