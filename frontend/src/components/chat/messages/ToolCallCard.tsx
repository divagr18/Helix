// src/components/chat/messages/ToolCallCard.tsx
import React from 'react';
import { type ToolCall } from '@/types';
import { Zap, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolCallCardProps {
    toolCall: ToolCall;
}

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ toolCall }) => {
    const statusInfo = {
        running: { icon: Loader2, text: 'Running...', color: 'text-blue-400', spin: true },
        complete: { icon: CheckCircle, text: 'Completed', color: 'text-green-400', spin: false },
        error: { icon: AlertTriangle, text: 'Error', color: 'text-red-400', spin: false },
    }[toolCall.status];

    const Icon = statusInfo.icon;

    return (
        <div className="border border-zinc-800/60 bg-zinc-900/50 rounded-lg p-3 mt-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-300">Tool Used: <span className="font-mono">{toolCall.name}</span></span>
                </div>
                <div className={cn("flex items-center gap-1.5 text-xs pl-4", statusInfo.color)}>
                    <Icon className={cn("h-3.5 w-3.5", statusInfo.spin && "animate-spin")} />
                    <span>{statusInfo.text}</span>
                </div>
            </div>
        </div>
    );
};