// src/components/chat/ChatModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CommandDialog, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useChatStore, type ChatMessage } from '@/stores/chatStore';
import { getCookie } from '@/utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sparkles, User, Loader2 } from 'lucide-react';

/**
 * Renders a single chat message bubble with appropriate styling.
 */
const ChatMessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isAssistant = message.role === 'assistant';
    const isError = message.role === 'error';

    return (
        <div className={`flex items-start gap-3 px-4 py-3 ${isAssistant ? '' : 'bg-muted/30'}`}>
            <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback>
                    {isAssistant ? <Sparkles className="h-5 w-5 text-primary" /> : <User className="h-5 w-5" />}
                </AvatarFallback>
            </Avatar>
            <div className="flex-grow pt-1">
                <div className={`prose prose-sm dark:prose-invert max-w-none text-left ${isError ? 'text-red-400' : ''}`}>
                    <Markdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                    </Markdown>
                </div>
            </div>
        </div>
    );
};

export const ChatModal = () => {
    const { 
        isOpen, 
        closeChat, 
        messages, 
        addMessage, 
        updateLastMessage,
        replaceLastMessage,
        isLoading, 
        setIsLoading,
        activeRepoId 
    } = useChatStore();

    const [query, setQuery] = useState('');
    const listRef = useRef<HTMLDivElement | null>(null);

    // Automatically scroll to the bottom when new messages are added
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e?: React.FormEvent) => {
    // stop the browser
        e?.preventDefault();

        if (!query.trim() || isLoading || !activeRepoId) return;

        addMessage({ role: 'user',    content: query });
        addMessage({ role: 'assistant', content: '' });
        setIsLoading(true);
        setQuery(''); // Clear the input

        try {
            const response = await fetch(
                `http://localhost:8000/api/v1/repositories/${activeRepoId}/chat/`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken') || '' 
                    },
                    body: JSON.stringify({ query }),
                }
            );

            if (!response.ok || !response.body) {
                const errorText = await response.text();
                throw new Error(errorText || `Request failed with status ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                updateLastMessage(chunk);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred.";
            // Replace the last (empty assistant) message with an error message
            replaceLastMessage({ role: 'error', content: `**Error:** ${errorMessage}` });
        } finally {
            setIsLoading(false);
        }
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
        // directly call submit logic
        handleSubmit();
        }
    };
    return (
        <CommandDialog open={isOpen} onOpenChange={(open) => !open && closeChat()}>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <CommandInput 
                    placeholder="Ask anything about this repository..." 
                    value={query}
                    onValueChange={setQuery}
                    disabled={isLoading}
                    onKeyDown={handleKeyDown}
                />
            </form>
            <CommandList ref={listRef} className="max-h-[50vh]">
                {messages.length === 0 && !isLoading && (
                    <CommandEmpty>
                        <div className="p-8 text-center">
                            <h3 className="font-semibold">Welcome to Helix Q&A</h3>
                            <p className="text-sm text-muted-foreground">
                                Ask a question about the current repository's functionality, structure, or documentation.
                            </p>
                        </div>
                    </CommandEmpty>
                )}

                {messages.map((message) => (
                    // CommandItem is used here to get the correct list styling
                    <CommandItem key={message.id} className="p-0" onSelect={() => { /* disable selection */ }}>
                        <ChatMessageBubble message={message} />
                    </CommandItem>
                ))}

                {isLoading && messages[messages.length - 1]?.role === 'assistant' && (
                    <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                )}
            </CommandList>
        </CommandDialog>
    );
};