// src/components/chat/messages/AssistantMessage.tsx
import React from 'react';
import { type ChatMessage } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ToolCallCard } from './ToolCallCard';
// You might want to add a markdown renderer later: import ReactMarkdown from 'react-markdown';

interface AssistantMessageProps {
    message: ChatMessage;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({ message }) => {
    return (
        <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 bg-zinc-800 border border-zinc-700">
                {/* Helix Logo Placeholder */}
                <AvatarFallback className="text-blue-400 text-xs font-bold">HX</AvatarFallback>
            </Avatar>
            <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-lg p-3 max-w-xl">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap pl-1">{message.content}</p>
                {message.tool_calls && (
                    <div className="mt-3 space-y-2">
                        {message.tool_calls.map(tc => <ToolCallCard key={tc.id} toolCall={tc} />)}
                    </div>
                )}
            </div>
        </div>
    );
};