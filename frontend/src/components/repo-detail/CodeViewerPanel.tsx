// src/components/repo-detail/CodeEditorPanel.tsx
import React from 'react';
import Editor, { type OnChange, type OnMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

// Define the props the component expects to receive from its parent.
interface CodeEditorPanelProps {
  content: string | null;
  language: string;
  isLoading: boolean;
  onContentChange: (value: string | undefined) => void;
}

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
    content,
    language,
    isLoading,
    onContentChange,
}) => {
    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editor.focus();
    };

    // 1. Handle the loading state first.
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-card text-muted-foreground">
                <Loader2 className="animate-spin h-8 w-8" />
            </div>
        );
    }

    // 2. Handle the "no content" state (when no file is selected).
    if (content === null) {
        return (
            <div className="flex items-center justify-center h-full bg-card text-muted-foreground p-4 text-center">
                Select a file from the tree to view its content.
            </div>
        );
    }

    // 3. If we have content, render the editor.
    return (
        <div className="h-full w-full bg-card">
            <Editor
                height="100%"
                width="100%"
                language={language}
                value={content} // The editor's value is directly bound to the content prop.
                theme="vs-dark"
                onChange={onContentChange}
                onMount={handleEditorDidMount}
                options={{
                    readOnly: false,
                    fontSize: 14,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    minimap: { enabled: true },
                    automaticLayout: true,
                }}
            />
        </div>
    );
};