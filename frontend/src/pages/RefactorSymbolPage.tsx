// src/pages/RefactorSymbolPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { type CodeSymbol } from '@/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { RefactorPageSkeleton } from '@/components/refactor/RefactorPageSkeleton';

// Import all the sub-components
import { SymbolHeader } from '@/components/refactor/SymbolHeader';
import { MetricsGrid } from '@/components/refactor/MetricsGrid';
import { RefactoringPanel } from '@/components/refactor/RefactoringPanel';
import { ImpactSummaryCard } from '@/components/refactor/ImpactSummaryCard';
import { DependenciesCard } from '@/components/refactor/DependenciesCard';
import { TestAnalysisCard } from '@/components/refactor/TestAnalysisCard';

export const RefactorSymbolPage = () => {
    const { repoId, symbolId } = useParams();

    // --- FIX: Use only one state variable for the data ---
    const [symbol, setSymbol] = useState<CodeSymbol | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (symbolId) {
            setIsLoading(true);
            setError(null); // Reset error state on new fetch
            axios.get(`/api/v1/symbols/${symbolId}/`)
                .then(response => {
                    setSymbol(response.data);
                })
                .catch(err => {
                    console.error("Failed to fetch symbol details:", err);
                    setError("Failed to load symbol. It may not exist or you may not have permission.");
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [symbolId]);

    if (isLoading) {
        return <RefactorPageSkeleton />;
    }

    // --- FIX: Check for error OR a null symbol after loading ---
    if (error || !symbol) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center h-[calc(100vh-150px)]">
                <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
                <h2 className="text-xl font-semibold">Failed to Load Symbol</h2>
                <p className="text-muted-foreground mt-2 max-w-md">
                    {error || "The requested symbol could not be found."}
                </p>
                <Button asChild variant="outline" size="sm" className="mt-6">
                    <Link to={repoId ? `/repository/${repoId}/intelligence` : '/dashboard'}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Intelligence
                    </Link>
                </Button>
            </div>
        );
    }

    // If we reach here, `symbol` is guaranteed to be a valid CodeSymbol object.
    return (
        <div className="p-6 space-y-6 mt-4">
            <SymbolHeader symbol={symbol} />
            <MetricsGrid symbol={symbol} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="xl:col-span-2 space-y-6">
                    <RefactoringPanel symbol={symbol} />
                </div>
                {/* Right Column */}
                <div className="space-y-6">
                    {/* ImpactSummaryCard needs suggestions, which we don't have yet.
                        We can pass an empty array for now or hide it. */}
                    <ImpactSummaryCard symbol={symbol} suggestions={[]} />
                    <DependenciesCard symbol={symbol} />
                    <TestAnalysisCard symbol={symbol} />
                </div>
            </div>
        </div>
    );
};