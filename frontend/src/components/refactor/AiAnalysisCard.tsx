// src/components/refactor/AiAnalysisCard.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, Brain, RefreshCw, Wand2 } from 'lucide-react';

// We'll define this type more formally later
interface AIRefactoringSuggestion {
    id: string;
    title: string;
    description: string;
}

export const AiAnalysisCard = () => {
    const [aiAnalyzing, setAiAnalyzing] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<AIRefactoringSuggestion[]>([]);

    const handleAIAnalysis = async () => {
        setAiAnalyzing(true);
        // In a real app, this would be an API call
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Mock response
        setAiSuggestions([
            { id: 'ai-1', title: 'Implement Caching Layer', description: 'Cache recent data to reduce API calls' },
        ]);
        setAiAnalyzing(false);
    };

    return (
        <Card className="bg-zinc-900/20 border-zinc-900/50">
            <CardHeader className="pb-3 px-4 pt-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-white flex items-center">
                        <Bot className="w-4 h-4 mr-2 text-purple-400" />
                        AI-Powered Refactoring
                    </CardTitle>
                    <Button
                        className="bg-orange-500 hover:bg-orange-600 text-black text-xs h-7 px-3"
                        onClick={handleAIAnalysis}
                        disabled={aiAnalyzing}
                    >
                        {aiAnalyzing ? (
                            <>
                                <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-3 h-3 mr-1.5" />
                                Analyze with AI
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
                {aiSuggestions.length > 0 ? (
                    <div className="space-y-3">
                        {/* We will build the suggestion item component later */}
                        {aiSuggestions.map((suggestion) => (
                            <div key={suggestion.id} className="p-3 bg-zinc-800/30 rounded border border-zinc-800/50">
                                <p className="text-sm font-medium text-white">{suggestion.title}</p>
                                <p className="text-xs text-zinc-400">{suggestion.description}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <Brain className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm text-zinc-500 mb-3">
                            Let AI analyze your function and suggest intelligent refactoring opportunities
                        </p>
                        <p className="text-xs text-zinc-600">
                            AI can identify performance optimizations, security improvements, and code quality enhancements
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};