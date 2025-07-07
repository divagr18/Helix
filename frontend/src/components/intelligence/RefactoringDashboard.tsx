// src/components/intelligence/RefactoringDashboard.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { type CodeSymbol } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Sigma, Orbit } from 'lucide-react';

export const RefactoringDashboard = () => {
    const { activeRepository } = useWorkspaceStore(); // Assuming your store has the active repo
    const [hotspots, setHotspots] = useState<CodeSymbol[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (activeRepository) {
            setIsLoading(true);
            axios.get(`/api/v1/repositories/${activeRepository.id}/intelligence/complexity-hotspots/`)
                .then(response => {
                    setHotspots(response.data);
                })
                .catch(err => console.error("Failed to fetch complexity hotspots", err))
                .finally(() => setIsLoading(false));
        }
    }, [activeRepository]);

    if (!activeRepository) {
        return <p className="text-muted-foreground">Please select a repository from the dashboard to see intelligence reports.</p>;
    }

    if (isLoading) {
        return <p>Loading complexity hotspots...</p>; // Add Skeleton loader here
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-semibold">Complexity Hotspots</h2>
                <p className="text-muted-foreground">
                    These are the most complex functions in the repository, based on Cyclomatic Complexity. They are often good candidates for refactoring.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hotspots.map(symbol => (
                    <Card key={symbol.id}>
                        <CardHeader>
                            <CardTitle className="truncate text-lg">
                                <Link to={`/code/repository/${activeRepository.id}?file=${symbol.source_code.split(':')[0]}&symbol=${symbol.id}`} className="hover:underline">
                                    {symbol.name}
                                </Link>
                            </CardTitle>
                            <CardDescription className="truncate">{symbol.unique_id.split(':')[0]}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex items-center justify-around text-sm">
                            <div className="flex items-center gap-2">
                                <Sigma className="h-4 w-4 text-muted-foreground" />
                                <span className="font-bold text-lg">{symbol.cyclomatic_complexity}</span>
                                <span className="text-muted-foreground">Complexity</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Orbit className="h-4 w-4 text-muted-foreground" />
                                <span className="font-bold text-lg">{symbol.loc}</span>
                                <span className="text-muted-foreground">LoC</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="text-center mt-8">
                <Button disabled>Scan for More Opportunities (Coming Soon)</Button>
            </div>
        </div>
    );
};