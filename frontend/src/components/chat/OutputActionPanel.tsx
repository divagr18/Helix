// src/components/chat/OutputActionPanel.tsx
import React from 'react';
import { type ActiveOutput } from '@/types';
import { Bot } from 'lucide-react';
import { ChatTestGenerator } from './outputs/ChatTestGenerator';

// Placeholder for a real output component
const TestGenerationOutput = ({ data }: { data: any }) => (
    <div className="p-4">
        <h3 className="font-semibold text-white">Generated Test for <span className="font-mono">{data.symbolName}</span></h3>
        <pre className="bg-zinc-900/80 p-3 rounded-md mt-2 text-xs text-zinc-300 overflow-x-auto">
            <code>{data.status === 'loading' ? 'Generating...' : data.generatedCode}</code>
        </pre>
    </div>
);

interface OutputActionPanelProps {
    activeOutput: ActiveOutput | null;
}

export const OutputActionPanel: React.FC<OutputActionPanelProps> = ({ activeOutput }) => {
    if (!activeOutput) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center text-zinc-500">
                    <Bot className="h-12 w-12 mx-auto mb-3" />
                    <p className="font-medium text-zinc-400">Helix Co-Pilot</p>
                    <p className="text-xs">Tool outputs and actions will appear here.</p>
                </div>
            </div>
        );
    }

    switch (activeOutput.type) {
        case 'test_generation':
            // The props from the `activeOutput` state now map perfectly
            // to the props of our new `ChatTestGenerator` component.
            return (
                <ChatTestGenerator
                    key={activeOutput.file.id}
                    file={activeOutput.file}
                    sourceCode={activeOutput.sourceCode}
                    generatedTests={activeOutput.generatedCode}
                    isLoading={activeOutput.status === 'loading'}
                />
            );
        default:
            return <div className="p-4">Unsupported output type.</div>;
    }
};