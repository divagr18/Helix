// src/components/refactor/MetricCard.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    valueColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, icon: Icon, valueColor }) => {
    return (
        <Card className="bg-zinc-900/20 border-zinc-900/50">
            <CardContent className="px-4 py-2 -mt-2 -mb-2"> {/* horizontal padding added, vertical reduced */}
                <div className="flex items-center justify-between pl-5 pr-5">
                    <div>
                        <div className="text-xs text-zinc-500 mb-0.5">{title}</div> {/* tighter bottom margin */}
                        <div className={cn("text-lg font-semibold", valueColor || 'text-zinc-200')}>
                            {value}
                        </div>
                    </div>
                    <Icon className={cn("w-6 h-6", valueColor || 'text-zinc-200')} />
                </div>
            </CardContent>
        </Card>
    );
};
