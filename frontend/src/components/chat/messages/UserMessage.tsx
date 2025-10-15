// src/components/chat/messages/UserMessage.tsx
import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface UserMessageProps {
    content: string;
}

export const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
    return (
        <div className="flex justify-end items-start gap-3">
            <div className="bg-blue-600/80 text-white rounded-lg p-3 max-w-xl">
                <p className="text-sm whitespace-pre-wrap">{content}</p>
            </div>
            <Avatar className="h-8 w-8">
                <AvatarFallback>U</AvatarFallback>
            </Avatar>
        </div>
    );
};