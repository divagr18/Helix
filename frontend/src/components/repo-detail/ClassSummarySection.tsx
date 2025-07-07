// File: src/components/repo-detail/ClassSummarySection.tsx

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Sparkles, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import { getCookie } from '@/utils';
import type { CodeClass } from '@/types';

interface ClassSummarySectionProps {
  codeClass: CodeClass | null | undefined;
  onSummaryGenerated?: () => void;
}

export const ClassSummarySection: React.FC<ClassSummarySectionProps> = ({
  codeClass,
  onSummaryGenerated,
}) => {
  const [generatedMarkdown, setGeneratedMarkdown] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Reset state whenever the selected class changes
  useEffect(() => {
    setGeneratedMarkdown(null);
    setIsLoading(false);
    setError(null);
    setIsOpen(false);
  }, [codeClass]);

  const handleGenerateSummary = useCallback(async () => {
    if (!codeClass) {
      toast.error('Cannot generate summary: No class selected.');
      return;
    }

    // If we already have generated text and we're not actively loading, just toggle
    if (generatedMarkdown && !isLoading) {
      setIsOpen((prev) => !prev);
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedMarkdown(''); // mark as started
    setIsOpen(true);
    toast.info(`Helix is summarizing class: ${codeClass.name}...`);

    try {
      const response = await fetch(
        `/api/v1/classes/${codeClass.id}/summarize/`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRFToken': getCookie('csrftoken') || '' },
        }
      );

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(
          errorText || `Failed to generate summary (status: ${response.status})`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        streamedText += chunk;
        setGeneratedMarkdown(streamedText);
      }

      // Trigger parent callback if provided
      if (onSummaryGenerated) {
        onSummaryGenerated();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toast.error('Summary Failed', { description: message });
    } finally {
      setIsLoading(false);
    }
  }, [codeClass, generatedMarkdown, isLoading, onSummaryGenerated]);

  if (!codeClass) {
    return null;
  }

  return (
    <div className="w-full">
      {generatedMarkdown === null && !isLoading && (
        <>
          {codeClass.summary ? (
            <div className="text-xs text-muted-foreground p-3 border-l-2 border-primary/50 bg-muted/20 rounded-r-md">
              <p className="italic">{codeClass.summary}</p>
              <Button
                onClick={handleGenerateSummary}
                variant="link"
                size="sm"
                className="p-0 h-auto text-xs mt-1 text-primary/80 hover:text-primary"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                Show & Regenerate Full Summary
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleGenerateSummary}
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-primary"
            >
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              Summarize with Helix
            </Button>
          )}
        </>
      )}

      {generatedMarkdown !== null && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full space-y-2">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="flex-grow justify-start text-xs text-muted-foreground hover:text-foreground -ml-2"
              >
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 mr-2" />
                ) : (
                  <ChevronDown className="h-4 w-4 mr-2" />
                )}
                <span>
                  {isLoading
                    ? 'Helix is thinking...'
                    : error
                      ? 'Error Occurred'
                      : 'Helix Class Summary'}
                </span>
              </Button>
            </CollapsibleTrigger>
            {!isLoading && (
              <Button
                onClick={handleGenerateSummary}
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                title="Regenerate"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <CollapsibleContent>
            <div className="rounded-md border border-border bg-background/50 p-3 text-left">
              {error ? (
                <p className="text-destructive flex items-center text-sm">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {error}
                </p>
              ) : (
                <Markdown remarkPlugins={[remarkGfm]}>
                  {generatedMarkdown}
                </Markdown>
              )}
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-2" />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
