// src/components/refactor/RefactoringList.tsx
import React, { useState } from 'react';
import { type RefactoringSuggestion } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Lightbulb } from 'lucide-react';
import { RefactoringSuggestionItem } from './RefactoringSuggestionItem'; // We will create this next

interface RefactoringListProps {
    suggestions: RefactoringSuggestion[];
}

export const RefactoringList: React.FC<RefactoringListProps> = ({ suggestions }) => {
    const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(
        suggestions.length > 0 ? suggestions[0].title : null // Default to selecting the first one
    );

    if (suggestions.length === 0) {
        return (
            <Card className="bg-zinc-900/20 border-zinc-900/50">
                <CardHeader className="pb-3 px-4 pt-4">
                    <CardTitle className="text-sm font-medium text-white flex items-center">
                        <Lightbulb className="w-4 h-4 mr-2 text-zinc-400" />
                        Refactoring Opportunities
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 text-center text-sm text-zinc-500 py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                            <Check className="w-6 h-6 text-green-400" />
                        </div>
                        <p className="font-medium text-zinc-300">No Issues Found</p>
                        <p className="max-w-xs">
                            Our automated analysis did not find any specific refactoring opportunities for this function.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="bg-zinc-900/20 border-zinc-900/50">
            <CardHeader className="pb-3 px-4 pt-4">
                <CardTitle className="text-sm font-medium text-white flex items-center justify-between">
                    <div className="flex items-center">
                        <Lightbulb className="w-4 h-4 mr-2 text-zinc-400" />
                        Refactoring Opportunities
                    </div>
                    <Badge variant="outline" className="border-zinc-700 text-zinc-500 bg-transparent text-xs">
                        {suggestions.length} suggestions
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                <div className="space-y-4">
                    {suggestions.map((suggestion) => (
                        <RefactoringSuggestionItem
                            key={suggestion.title} // Assuming title is unique for mock data
                            suggestion={suggestion}
                            isSelected={selectedSuggestionId === suggestion.title}
                            onSelect={() => setSelectedSuggestionId(suggestion.title)}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};