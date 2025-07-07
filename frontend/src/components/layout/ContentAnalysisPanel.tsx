// src/components/layout/ContentAnalysisPanel.tsx
import React, { useState, useEffect } from 'react';
import { useRepo } from '@/contexts/RepoContext';
import { CodeEditorPanel } from '@/components/repo-detail/CodeEditorPanel';
import { SymbolInspector } from '@/components/content/SymbolInspector';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { getLanguage } from '@/utils/language'; // Assuming you have this helper

export const ContentAnalysisPanel = () => {
    const { selectedFile, fileContent, isLoadingFileContent } = useRepo();

    // This is the "scratchpad" state for user edits.
    const [modifiedContent, setModifiedContent] = useState<string | null>(null);

    // Sync the scratchpad state with the file content from the context
    // when a new file is loaded.
    useEffect(() => {
        setModifiedContent(fileContent);
    }, [fileContent]);

    if (!selectedFile) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Select a file from the navigation panel.</p>
            </div>
        );
    }

    return (

        <div className="h-full flex flex-col">
            <div className="p-2 border-b border-border bg-card flex-shrink-0">
                <span className="text-sm font-mono">{selectedFile.file_path}</span>
                {/* We can add a "Save" button here later */}
            </div>
            <div className="flex-grow min-h-0">
                <CodeEditorPanel
                    // The initial content comes directly from the context
                    initialContent={fileContent}
                    isLoading={isLoadingFileContent}
                    language={getLanguage(selectedFile.file_path)}
                    // The callback updates our local scratchpad state
                    onContentChange={setModifiedContent}
                />
            </div>
        </div>

    );
};