// src/components/chat/ChatInput.tsx
import React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send, CornerDownLeft } from 'lucide-react';

interface ChatInputProps {
    input: string;
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
    isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ input, onInputChange, onSubmit, isLoading }) => {
    return (
        <form onSubmit={onSubmit} className="p-4 border-t border-zinc-800/60 bg-zinc-900/30">
            <div className="relative">
                <Textarea
                    value={input}
                    onChange={onInputChange}
                    placeholder="Ask Helix to find, explain, or refactor code..."
                    className="bg-zinc-800/50 border-zinc-700 rounded-lg pr-20"
                    rows={1}
                />
                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                        Send <CornerDownLeft className="h-3 w-3" />
                    </span>
                    <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-8 w-8 bg-blue-600 hover:bg-blue-700">
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </form>
    );
};