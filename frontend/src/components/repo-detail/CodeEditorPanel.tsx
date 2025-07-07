// src/components/repo-detail/CodeEditorPanel.tsx
import React, { useState, useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Loader2 } from 'lucide-react';

interface CodeEditorPanelProps {
    initialContent: string | null;
    language: string;
    isLoading: boolean;
    onContentChange: (newContent: string) => void;
}

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
    initialContent,
    language,
    isLoading,
    onContentChange,
}) => {
    const [editorContent, setEditorContent] = useState(initialContent || '');
    const editorRef = useRef<any>(null);

    // --- THIS IS THE KEY FIX ---
    // This effect syncs the editor's internal state with the prop from the context
    // ONLY when the initialContent prop itself changes (i.e., a new file is loaded).
    useEffect(() => {
        setEditorContent(initialContent || '');
    }, [initialContent]);

    const handleEditorChange = (value: string | undefined) => {
        const newContent = value || '';
        setEditorContent(newContent);
        onContentChange(newContent); // Notify parent of the change
    };

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
        editor.focus();
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Editor
            height="100%"
            language={language}
            value={editorContent}

            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{
                readOnly: false,
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                // --- THIS IS THE FIX ---
                minimap: {
                    enabled: false // Explicitly disable the minimap
                },
                // --- END FIX ---
                padding: {
                    top: 10,
                    bottom: 10
                },
            }}
        />
    );
};