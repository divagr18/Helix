// src/components/readme/ReadmeEditorPanel.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useRepo } from '@/contexts/RepoContext';
import { Button } from '@/components/ui/button';
import { Sparkles, Save, Loader2, BookOpen } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export const ReadmeEditorPanel = () => {
    const { repo } = useRepo();
    const [markdown, setMarkdown] = useState<string | undefined>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (repo) {
            setIsLoading(true);
            // API endpoint to fetch the existing repo-level README
            axios.get(`/api/v1/repositories/${repo.id}/readme/`)
                .then(response => {
                    setMarkdown(response.data.content_md || "## Welcome to your Repository!\n\nClick 'Generate with Helix' to create an architectural overview.");
                })
                .catch(() => {
                    setMarkdown("## Welcome to your Repository!\n\nCould not load existing README. Click 'Generate with Helix' to create one.");
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [repo]);

    const handleGenerate = () => {
        if (!repo) return;
        setIsGenerating(true);
        setMarkdown(""); // Clear existing content
        toast.info("Generating repository README...");

        // This will call the streaming endpoint we designed
        const eventSource = new EventSource(`/api/v1/repositories/${repo.id}/generate-module-readme-stream/?module_path=`);

        eventSource.onmessage = (event) => {
            const chunk = JSON.parse(event.data).chunk;
            setMarkdown(prev => (prev || "") + chunk);
        };

        eventSource.onerror = () => {
            toast.error("Failed to generate README.");
            eventSource.close();
            setIsGenerating(false);
        };

        // A special event to signal the end of the stream
        eventSource.addEventListener('end', () => {
            toast.success("README generated successfully.");
            eventSource.close();
            setIsGenerating(false);
        });
    };

    const handleSave = () => {
        if (!repo || !markdown) return;
        setIsSaving(true);
        toast.info("Committing README.md to a new branch...");
        // This would be a new endpoint to trigger a PR creation
        // For now, we'll simulate it.
        setTimeout(() => {
            toast.success("Pull request created successfully!");
            setIsSaving(false);
        }, 2000);
    };

    if (isLoading) {
        return <Skeleton className="h-full w-full" />;
    }

    return (
        <div className="h-full flex flex-col bg-zinc-950">
            <div className="p-3 border-b border-border flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">Repository README</h2>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleGenerate} disabled={isGenerating || isSaving}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {isGenerating ? 'Generating...' : 'Regenerate'}
                    </Button>
                    <Button onClick={handleSave} disabled={isGenerating || isSaving || !markdown}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Commit to README.md
                    </Button>
                </div>
            </div>
            <div className="flex-grow min-h-0 overflow-y-auto" data-color-mode="dark">
                {isLoading ? (
                    <div className="p-6 space-y-4">
                        <Skeleton className="h-8 w-1/2 bg-zinc-900" />
                        <Skeleton className="h-4 w-full bg-zinc-900" />
                        <Skeleton className="h-4 w-full bg-zinc-900" />
                        <Skeleton className="h-4 w-3/4 bg-zinc-900" />
                    </div>
                ) : (
                    <MDEditor.Markdown
                        source={markdown}
                        // Apply all our styling and word-wrap classes here
                        className={cn(
                            "prose prose-invert max-w-none p-6",
                            "prose-p:text-zinc-300 prose-headings:text-zinc-100",
                            "prose-pre:bg-zinc-900 prose-pre:whitespace-pre-wrap prose-pre:break-words"
                        )}
                        style={{
                            backgroundColor: '#09090b', // zinc-950
                        }}
                    />
                )}
            </div>
        </div>
    );
};