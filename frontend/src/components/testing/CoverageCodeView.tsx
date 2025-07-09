// src/components/testing/CoverageCodeView.tsx
import React, { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { type editor } from 'monaco-editor';
import { getLanguage } from '@/utils/language';

interface CoverageCodeViewProps {
    filePath: string;
    content: string | null;
    coveredLines: number[];
    missedLines: number[];
}

export const CoverageCodeView: React.FC<CoverageCodeViewProps> = ({ filePath, content, coveredLines, missedLines }) => {
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;
    };

    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !content) return;

        // Create decorations for covered and missed lines
        const decorations: editor.IModelDeltaDecoration[] = [
            ...coveredLines.map(line => ({
                range: new monaco.Range(line, 1, line, 1),
                options: { isWholeLine: true, className: 'bg-green-500/20', linesDecorationsClassName: 'border-l-4 border-green-500' }
            })),
            ...missedLines.map(line => ({
                range: new monaco.Range(line, 1, line, 1),
                options: { isWholeLine: true, className: 'bg-red-500/20', linesDecorationsClassName: 'border-l-4 border-red-500' }
            })),
        ];

        // Apply the decorations to the editor
        const decorationIds = editor.createDecorationsCollection(decorations);

        // Clean up decorations when the component unmounts or props change
        return () => {
            decorationIds.clear();
        };
    }, [content, coveredLines, missedLines]);

    if (content === null) return <div>Loading code...</div>;

    return (
        <Editor
            // --- THIS IS THE FIX ---
            key={filePath} // Force re-mount when the file path changes
            // --- END FIX ---
            height="100%"
            language={getLanguage(filePath)}
            value={content}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={{ readOnly: true, minimap: { enabled: false } }}
        />
    );
};