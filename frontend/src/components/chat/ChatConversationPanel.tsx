// src/components/chat/ChatConversationPanel.tsx
import React, { useRef, useEffect } from 'react';
import { type ChatMessage } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserMessage } from './messages/UserMessage';
import { AssistantMessage } from './messages/AssistantMessage';
import { ChatInput } from './ChatInput';

interface ChatConversationPanelProps {
    messages: ChatMessage[];
    input: string;
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
}

export const ChatConversationPanel: React.FC<ChatConversationPanelProps> = ({ messages, ...inputProps }) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages]);

    return (
        <div className="flex flex-col h-full">
            <ScrollArea className="flex-grow">
                <div className="p-6 space-y-6">
                    {messages.map(msg =>
                        msg.role === 'user'
                            ? <UserMessage key={msg.id} content={msg.content} />
                            : <AssistantMessage key={msg.id} message={msg} />
                    )}
                </div>
                <div ref={scrollAreaRef} />
            </ScrollArea>
            <ChatInput {...inputProps} />
        </div>
    );
};