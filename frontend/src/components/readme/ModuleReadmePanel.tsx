// src/components/readme/ModuleReadmePanel.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useRepo } from '@/contexts/RepoContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Loader2, Folder, FileText } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';

interface ModuleReadmePanelProps {
    folderPath: string;
}

export const ModuleReadmePanel: React.FC<ModuleReadmePanelProps> = ({ folderPath }) => {
    const { repo } = useRepo();
    const [markdown, setMarkdown] = useState<string | undefined>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (repo && folderPath) {
            setIsLoading(true);
            // API endpoint to fetch the existing module-level README
            axios.get(`/api/v1/repositories/${repo.id}/readme/?module_path=${folderPath}`)
                .then(response => {
                    setMarkdown(response.data.content_md);
                })
                .catch(() => {
                    setMarkdown(""); // Default to empty if not found
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [repo, folderPath]);

    const handleGenerate = () => {
        if (!repo) return;
        setIsGenerating(true);
        setMarkdown("");
        toast.info(`Generating README for '${folderPath}'...`);

        const eventSource = new EventSource(`/api/v1/repositories/${repo.id}/generate-module-readme-stream/?module_path=${folderPath}`);

        eventSource.onmessage = (event) => {
            const chunk = JSON.parse(event.data).chunk;
            setMarkdown(prev => (prev || "") + chunk);
        };

        eventSource.onerror = () => {
            toast.error("Failed to generate README.");
            eventSource.close();
            setIsGenerating(false);
        };

        eventSource.addEventListener('end', () => {
            toast.success("README generated successfully.");
            eventSource.close();
            setIsGenerating(false);
        });
    };

    return (
        <div className="h-full flex flex-col bg-card border-l border-border">
            <div className="p-3 border-b border-border flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Module README</h3>
                </div>
                <p className="text-sm text-muted-foreground font-mono truncate mt-1" title={folderPath}>
                    {folderPath}
                </p>
            </div>

            <ScrollArea className="flex-grow min-h-0" data-color-mode="dark">
                {isLoading ? (
                    <div className="p-4"><p className="text-sm text-muted-foreground">Loading...</p></div>
                ) : markdown ? (
                    <MDEditor.Markdown source={markdown} style={{ padding: '16px', backgroundColor: 'var(--card)' }} />
                ) : (
                    <div className="p-6 text-center">
                        <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No README for this module.</p>
                        <p className="text-xs text-muted-foreground/70">Click below to generate one.</p>
                    </div>
                )}
            </ScrollArea>

            <div className="p-3 border-t border-border mt-auto flex-shrink-0">
                <Button className="w-full" onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isGenerating ? 'Generating...' : markdown ? 'Regenerate README' : 'Generate README'}
                </Button>
            </div>
        </div>
    );
};