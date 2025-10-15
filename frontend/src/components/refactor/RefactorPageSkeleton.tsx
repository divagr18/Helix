// src/components/refactor/RefactorPageSkeleton.tsx
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const RefactorPageSkeleton = () => {
    return (
        <div className="p-6 space-y-6 animate-pulse">
            {/* Header Skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-4 w-2/3" />
            </div>

            {/* Metrics Grid Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                ))}
            </div>

            {/* Main Content Skeleton */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                    <Skeleton className="h-48" />
                    <Skeleton className="h-96" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-32" />
                    <Skeleton className="h-48" />
                    <Skeleton className="h-48" />
                </div>
            </div>
        </div>
    );
};