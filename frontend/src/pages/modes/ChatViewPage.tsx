// src/pages/modes/ChatViewPage.tsx
import React, { useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ChatConversationPanel } from '@/components/chat/ChatConversationPanel';
import { OutputActionPanel } from '@/components/chat/OutputActionPanel';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Construction } from 'lucide-react';
import { type ChatMessage, type ActiveOutput } from '@/types';

// --- MOCKUP DATA ---
const initialMessages: ChatMessage[] = [
    {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm Helix, your AI co-pilot. How can I help you with this repository?",
    },
    {
        id: '2',
        role: 'user',
        content: "Generate a unit test for the `calculate_tax` function."
    },
    {
        id: '3',
        role: 'assistant',
        content: "Certainly. I'm generating a unit test for `calculate_tax` now.",
        tool_calls: [
            { id: 'tc1', name: 'generate_tests_for_symbol', status: 'running' }
        ]
    }
];
import { type CodeFile } from '@/types'; // Make sure to import CodeFile

const mockFile: CodeFile = {
    id: 101,
    file_path: 'src/utils/billing.py',
    // You would populate these with real data from your API
    symbols: [{ id: 201, name: 'calculate_tax', type: 'function', start_line: 10, end_line: 25, loc: 15, cyclomatic_complexity: 4 }],
    classes: [],
};
const initialOutput: ActiveOutput = {
    type: 'test_generation',
    status: 'loading', // Use the 'status' property
    file: mockFile,
    sourceCode: "def calculate_tax(amount):\n    return amount * 0.2",
    generatedCode: null, // This is the correct property name
};
// --- END MOCKUP DATA ---

export const ChatViewPage = () => {
    const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
    const [activeOutput, setActiveOutput] = useState<ActiveOutput | null>(initialOutput);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(true); // Start in loading state to show the tool running

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        // This is where you will call your streaming API
        console.log("Submitting:", input);
        // For now, we'll just add the user message
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: input }]);
        setInput('');
    };

    return (
        <div className="h-full bg-zinc-950 text-white">
            {/* Development Notice */}
            <div className="p-4 border-b border-zinc-800">
                <Alert className="border-amber-800 bg-amber-950/30">
                    <Construction className="h-4 w-4 text-amber-400" />
                    <AlertDescription className="text-amber-200">
                        <strong>Under Development:</strong> This chat interface is currently a mockup.
                        Helix's chat functionality is currently being reworked and will be available in a future release.
                    </AlertDescription>
                </Alert>
            </div>

            <div className="h-[calc(100%-80px)]">
                <ResizablePanelGroup direction="horizontal" className="h-full">
                    <ResizablePanel defaultSize={60} minSize={40}>
                        <ChatConversationPanel
                            messages={messages}
                            input={input}
                            onInputChange={handleInputChange}
                            onSubmit={handleSubmit}
                            isLoading={isLoading}
                        />
                    </ResizablePanel>
                    <ResizableHandle withHandle className="bg-zinc-800/60 hover:bg-zinc-700/60 transition-colors" />
                    <ResizablePanel defaultSize={40} minSize={30}>
                        <OutputActionPanel activeOutput={activeOutput} />
                    </ResizablePanel>
                </ResizablePanelGroup>
            </div>
        </div>
    );
};