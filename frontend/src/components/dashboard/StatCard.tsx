// src/components/dashboard/StatCard.tsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    valueClassName?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, valueClassName }) => {
    return (
        <Card className="bg-zinc-900/20 border-zinc-900/50">
            <CardContent className="px-3">
                <div className="flex items-center ml-3 justify-between">
                    <div>
                        <p className="text-sm text-zinc-400">{title}</p>
                        <p className={cn("text-xl font-semibold", valueClassName)}>{value}</p>
                    </div>
                    <Icon className={cn("w-6 h-6", valueClassName)} />
                </div>
            </CardContent>
        </Card>
    );
};
