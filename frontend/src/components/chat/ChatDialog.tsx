import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Send, Loader2, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ChatDialogProps {
    isOpen: boolean;
    onClose: () => void;
    repositoryId: number | null;
    repositoryName?: string;
}

export const ChatDialog: React.FC<ChatDialogProps> = ({
    isOpen,
    onClose,
    repositoryId,
    repositoryName = 'Repository',
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (isOpen) {
            // Focus input when dialog opens
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSendMessage = async () => {
        if (!input.trim() || !repositoryId || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch(`/api/v1/repositories/${repositoryId}/chat/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    query: userMessage.content,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            // Create assistant message placeholder
            const assistantMessageId = (Date.now() + 1).toString();
            const assistantMessage: Message = {
                id: assistantMessageId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);

            // Stream the response
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });

                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const lastMessage = newMessages[newMessages.length - 1];
                        if (lastMessage.id === assistantMessageId) {
                            lastMessage.content += chunk;
                        }
                        return newMessages;
                    });
                }
            }
        } catch (error) {
            console.error('Chat error:', error);

            const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleClearChat = () => {
        setMessages([]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl h-[600px] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b border-gray-800">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <MessageSquare className="h-5 w-5 text-blue-400" />
                            <div>
                                <DialogTitle>Chat with Helix</DialogTitle>
                                <p className="text-sm text-gray-400 mt-1">
                                    Ask questions about {repositoryName}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {messages.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearChat}
                                    className="text-gray-400 hover:text-white"
                                >
                                    Clear
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="text-gray-400 hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <MessageSquare className="h-12 w-12 text-gray-600 mb-4" />
                            <h3 className="text-lg font-medium text-gray-300 mb-2">
                                Start a conversation
                            </h3>
                            <p className="text-sm text-gray-400 max-w-md">
                                Ask me anything about the codebase. I can help you understand
                                functions, architecture, dependencies, and more.
                            </p>
                            <div className="mt-6 space-y-2 text-left">
                                <p className="text-xs text-gray-500">Try asking:</p>
                                <div className="space-y-1">
                                    <button
                                        onClick={() => setInput('How does authentication work?')}
                                        className="block text-sm text-blue-400 hover:text-blue-300 text-left"
                                    >
                                        • How does authentication work?
                                    </button>
                                    <button
                                        onClick={() => setInput('What are the main components?')}
                                        className="block text-sm text-blue-400 hover:text-blue-300 text-left"
                                    >
                                        • What are the main components?
                                    </button>
                                    <button
                                        onClick={() => setInput('Show me database models')}
                                        className="block text-sm text-blue-400 hover:text-blue-300 text-left"
                                    >
                                        • Show me database models
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={cn(
                                        'flex gap-3',
                                        message.role === 'user' ? 'justify-end' : 'justify-start'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'rounded-lg px-4 py-3 max-w-[80%]',
                                            message.role === 'user'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-800 text-gray-100'
                                        )}
                                    >
                                        {message.role === 'assistant' ? (
                                            <div className="prose prose-invert prose-sm max-w-none">
                                                <ReactMarkdown
                                                    components={{
                                                        code: ({ className, children, ...props }: any) => {
                                                            const isInline = !className;
                                                            return isInline ? (
                                                                <code className="bg-gray-900 px-1.5 py-0.5 rounded text-sm" {...props}>
                                                                    {children}
                                                                </code>
                                                            ) : (
                                                                <code className="block bg-gray-900 p-3 rounded-lg overflow-x-auto" {...props}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        },
                                                    }}
                                                >
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Input */}
                <div className="border-t border-gray-800 px-6 py-4">
                    <div className="flex gap-2">
                        <Input
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask a question... (Press Enter to send)"
                            disabled={isLoading || !repositoryId}
                            className="flex-1 bg-gray-800 border-gray-700 focus:border-blue-500"
                        />
                        <Button
                            onClick={handleSendMessage}
                            disabled={isLoading || !input.trim() || !repositoryId}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">Ctrl+K</kbd> to open chat anywhere
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};
