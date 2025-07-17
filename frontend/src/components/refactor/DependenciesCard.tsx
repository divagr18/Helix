// src/components/refactor/DependenciesCard.tsx
import React from 'react';
import { type CodeSymbol } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Network, ArrowDown, ArrowUp } from 'lucide-react';

interface DependenciesCardProps {
    symbol: CodeSymbol;
}

export const DependenciesCard: React.FC<DependenciesCardProps> = ({ symbol }) => {
    const { incoming_calls, outgoing_calls } = symbol;

    return (
        <Card className="bg-zinc-900/20 border-zinc-900/50">
            <CardHeader className="pb-2 px-8 pt-3 -mt-4">
                <CardTitle className="text-sm font-medium text-white flex items-center">
                    <Network className="w-4 h-4 mr-2 text-zinc-400" />
                    Dependencies
                </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-3 -mt-6">
                <div className="space-y-3">
                    <div>
                        <div className="text-xs text-zinc-500 mb-2">Called by ({incoming_calls.length})</div>
                        <div className="space-y-1">
                            {incoming_calls.length > 0 ? (
                                incoming_calls.map((caller) => (
                                    <div key={caller.id} className="flex items-center space-x-2 text-xs">
                                        <ArrowDown className="w-3 h-3 text-blue-400 flex-shrink-0" />
                                        <span className="text-zinc-300 font-mono truncate" title={caller.unique_id}>{caller.name}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-zinc-600 italic">No internal callers found.</p>
                            )}
                        </div>
                    </div>
                    <Separator className="bg-zinc-800/50" />
                    <div>
                        <div className="text-xs text-zinc-500 mb-2">Calls ({outgoing_calls.length})</div>
                        <div className="space-y-1 -mb-4">
                            {outgoing_calls.length > 0 ? (
                                outgoing_calls.map((called) => (
                                    <div key={called.id} className="flex items-center space-x-2 text-xs">
                                        <ArrowUp className="w-3 h-3 text-green-400 flex-shrink-0" />
                                        <span className="text-zinc-300 font-mono truncate" title={called.unique_id}>{called.name}</span>
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-zinc-600 italic">No outgoing calls found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};