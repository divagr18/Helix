// src/components/repo-detail/CodeEditorPanel.tsx
import React, { useState, useEffect } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import { GitPullRequestArrow, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

interface CodeEditorPanelProps {
    fileContent: string | null;
    language: string;
    isLoading: boolean;
    onCodeChange: (newCode: string) => void;
    modifiedContent: string | null;
    onContentChange: (newCode: string | undefined) => void;
    onProposeChange: () => void; // A callback to open the PR modal
    isDirty: boolean; // Callback to notify parent of edits
}

export const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
    fileContent,
    language,
    isLoading,
    modifiedContent,
    onCodeChange,
    onProposeChange,
    isDirty,
}) => {
    const [editorContent, setEditorContent] = useState(fileContent || '');

    // When the selected file changes, update the editor's content
    useEffect(() => {
        setEditorContent(fileContent || '');
    }, [fileContent]);

    const handleEditorChange = (value: string | undefined) => {
        const newContent = value || '';
        setEditorContent(newContent);
        onCodeChange(newContent);
    };

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editor.addAction({
            id: 'helix-explain-selection',
            label: 'Helix: Explain Selection',
            contextMenuGroupId: 'navigation', // Group it with other actions
            contextMenuOrder: 1.5,
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyE,
            ],
            run: function (ed) {
                const selection = ed.getModel()?.getValueInRange(ed.getSelection()!);
                if (selection) {
                    // --- TRIGGER THE AI ACTION ---
                    // Call a function passed via props to start the explanation
                    // e.g., props.onExplainSelection(selection);
                    console.log("Explain this:", selection);
                }
                return null;
            }
        });

        // Add more actions for "Refactor" and "Generate Tests"
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col h-full relative">
            {/* --- NEW: "Propose Change" Button --- */}
            {isDirty && (
                <div className="absolute top-2 right-4 z-10">
                    <Button size="sm" onClick={onProposeChange}>
                        <GitPullRequestArrow className="mr-2 h-4 w-4" />
                        Propose Change...
                    </Button>
                </div>
            )}

            <Editor
                height="100%"
                language={language}
                value={modifiedContent ?? fileContent ?? ''} // Show modified content if it exists, otherwise original
                onChange={onCodeChange}
                onMount={handleEditorDidMount}
                theme="vs-dark"
                options={{
                    readOnly: false,
                    minimap: { enabled: true },
                    fontSize: 14,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                }}
            />
        </div>
    );
};