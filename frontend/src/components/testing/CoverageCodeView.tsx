// src/components/testing/CoverageCodeView.tsx
import React, { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
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

        const model = editor.getModel();
        if (!model) return;

        // Build decorations covering the entire width of each line:
        const decorations: editor.IModelDeltaDecoration[] = [
            ...coveredLines.map(line => ({
                range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
                options: {
                    isWholeLine: true,
                    // applies across the entire text area
                    inlineClassName: 'fullLineHighlightGreen',
                    // gutter border:
                    linesDecorationsClassName: 'border-l-4 border-green-500',
                }
            })),
            ...missedLines.map(line => ({
                range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
                options: {
                    isWholeLine: true,
                    inlineClassName: 'fullLineHighlightRed',
                    linesDecorationsClassName: 'border-l-4 border-red-500',
                }
            })),
        ];

        // Apply them:
        const decorationCollection = editor.createDecorationsCollection(decorations);

        return () => decorationCollection.clear();
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
            options={{ readOnly: true, minimap: { enabled: false }, glyphMargin: true }}
        />
    );
};