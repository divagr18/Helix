import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useRepo } from '@/contexts/RepoContext';
import { CodeEditorPanel } from '@/components/repo-detail/CodeEditorPanel';
import { ReadmeEditorPanel } from '@/components/readme/ReadmeEditorPanel';
import { Folder } from 'lucide-react';
import { getLanguage } from '@/utils/language';
import { Skeleton } from '@/components/ui/skeleton';

export const ContentAnalysisPanel = () => {
    const { selectedFile, selectedFolderPath } = useRepo();
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    useEffect(() => {
        if (selectedFile) {
            setIsLoadingContent(true);
            setFileContent(null);
            axios
                .get(`/api/v1/files/${selectedFile.id}/content/`)
                .then(response => {
                    const content = typeof response.data === 'string' ? response.data : response.data.content;
                    setFileContent(content);
                })
                .catch(() => {
                    setFileContent(`// Error: Could not load content for ${selectedFile.file_path}`);
                })
                .finally(() => {
                    setIsLoadingContent(false);
                });
        } else {
            setFileContent(null);
        }
    }, [selectedFile]);

    const [modifiedContent, setModifiedContent] = useState<string | null>(null);
    useEffect(() => {
        setModifiedContent(fileContent);
    }, [fileContent]);

    // Unified wrapper ensures fixed height and internal scrolling
    return (
        <div className="h-full flex flex-col overflow-hidden">
            {selectedFile ? (
                <>
                    <div className="p-2 border-b border-border bg-card flex-shrink-0">
                        <span className="text-sm font-mono">{selectedFile.file_path}</span>
                    </div>
                    <div className="flex-grow min-h-0 overflow-auto">
                        <CodeEditorPanel
                            key={selectedFile.id}
                            initialContent={fileContent}
                            isLoading={isLoadingContent}
                            language={getLanguage(selectedFile.file_path)}
                            onContentChange={setModifiedContent}
                        />
                    </div>
                </>
            ) : selectedFolderPath ? (
                <div className="flex-grow min-h-0 overflow-auto flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                        <Folder className="h-12 w-12 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">Module Selected</h3>
                        <p className="text-sm font-mono">{selectedFolderPath}</p>
                        <p className="mt-2 text-xs">View or generate the module README in the right-hand panel.</p>
                    </div>
                </div>
            ) : (
                <div className="flex-grow min-h-0 overflow-auto">
                    <ReadmeEditorPanel />
                </div>
            )}
        </div>
    );
};
