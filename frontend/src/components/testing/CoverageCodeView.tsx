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

        const decorations: editor.IModelDeltaDecoration[] = [
            ...coveredLines.map(line => ({
                range: new monaco.Range(line, 1, line, 1),
                options: {
                    isWholeLine: true,
                    glyphMarginClassName: 'bg-green-500', // Gutter indicator
                }
            })),
            ...missedLines.map(line => ({
                range: new monaco.Range(line, 1, line, 1),
                options: {
                    isWholeLine: true,
                    glyphMarginClassName: 'bg-red-500', // Gutter indicator
                }
            })),
        ];

        const decorationCollection = editor.createDecorationsCollection(decorations);
        return () => decorationCollection.clear();
    }, [content, coveredLines, missedLines]);

    if (content === null) return <div className="flex items-center justify-center h-full text-zinc-500">Loading code...</div>;

    return (
        <Editor
            key={filePath}
            height="100%"
            language={getLanguage(filePath)}
            value={content}
            onMount={handleEditorDidMount}
            theme="vs-dark" // The default dark theme works well with this aesthetic
            options={{
                readOnly: true,
                minimap: { enabled: false },
                glyphMargin: true, // Enable the gutter margin for our indicators
                lineNumbersMinChars: 3,
                scrollBeyondLastLine: false,
                padding: { top: 10 },
            }}
        />
    );
};