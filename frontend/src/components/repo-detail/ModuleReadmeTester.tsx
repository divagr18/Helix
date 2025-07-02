// src/components/repo-detail/ModuleReadmeTester.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { getCookie } from '@/utils';
import { Sparkles, Loader2, FileText, CheckCircle, AlertTriangle, History, Search } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import axios from 'axios';
import { type AsyncTaskStatus } from '@/types';

interface ModuleReadmeTesterProps {
  repoId: number;
}

type WorkflowStep = 'initial' | 'checking_coverage' | 'needs_documentation' | 'documenting' | 'needs_rescan' | 'rescanning' | 'ready_to_generate' | 'generating_readme';
type ComponentState = 'idle' | 'fetching_existing' | 'generating' | 'displaying';
export const ModuleReadmeTester: React.FC<ModuleReadmeTesterProps> = ({ repoId }) => {
  const [modulePath, setModulePath] = useState('');
  const [generatedReadme, setGeneratedReadme] = useState<string | null>(null);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('initial');
  const [undocumentedCount, setUndocumentedCount] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<AsyncTaskStatus | null>(null);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [componentState, setComponentState] = useState<ComponentState>('idle');
  const [isLoading, setIsLoading] = useState(false);

  const handleFetchExistingReadme = useCallback(async (path: string) => {
    setComponentState('fetching_existing');
    setReadmeContent(null); // Clear previous content
    try {
      const response = await axios.get(`http://localhost:8000/api/v1/repositories/${repoId}/module-documentation/?path=${encodeURIComponent(path)}`);
      setReadmeContent(response.data.content_md);
      toast.success("Loaded saved README for this module.");
      setComponentState('displaying');
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // This is the expected "not found" case, not an actual error.
        toast.info("No saved README found for this path. You can generate a new one.");
      } else {
        toast.error("Failed to check for existing README.");
      }
      setComponentState('idle'); // Revert to idle so user can generate
    }
  }, [repoId]);
  // --- Step 1: Analyze Module Coverage ---
  const handleCheckCoverage = useCallback(async () => {
    setWorkflowStep('checking_coverage');
    toast.info("Analyzing module documentation coverage...");
    try {
      const response = await axios.get(`http://localhost:8000/api/v1/repositories/${repoId}/module-coverage/?path=${encodeURIComponent(modulePath.trim())}`);
      const count = response.data.undocumented_count;
      setUndocumentedCount(count);
      if (count > 0) {
        setWorkflowStep('needs_documentation');
        toast.warning(`Found ${count} undocumented symbols.`, { description: "Generate docstrings first for a better README." });
      } else {
        setWorkflowStep('ready_to_generate');
        toast.success("All symbols are documented. Ready to generate README.");
      }
    } catch (error) {
      toast.error("Failed to check module coverage.");
      setWorkflowStep('initial');
    }
  }, [repoId, modulePath]);

  // --- Step 2: Trigger Scoped Batch Documentation ---
  const handleStartBatchDocumentation = useCallback(async () => {
    setWorkflowStep('documenting');
    toast.loading("Starting batch documentation job...", { id: 'batch-doc-start' });
    try {
      const response = await axios.post(
        `http://localhost:8000/api/v1/repositories/${repoId}/batch-document-module/`,
        { path: modulePath.trim() }, // This is the request body
        {
          withCredentials: true,
          headers: { 'X-CSRFToken': getCookie('csrftoken') } // This is part of the config
        }
      );
      toast.dismiss('batch-doc-start');
      setActiveTaskId(response.data.task_id);
    } catch (error) {
      toast.dismiss('batch-doc-start');
      toast.error("Failed to start batch documentation job.");
      setWorkflowStep('needs_documentation');
    }
  }, [repoId, modulePath]);

  // --- Step 2.5: Trigger a re-scan after documentation is generated ---
  const handleRescanRepository = useCallback(async () => {
    setWorkflowStep('rescanning');
    toast.loading("Re-scanning repository to detect new docstrings...", { id: 'rescan-start' });
    try {
      // We use the existing re-process endpoint
      const response = await axios.post(
        `http://localhost:8000/api/v1/repositories/${repoId}/reprocess/`,
        {}, // Empty request body
        {
          withCredentials: true,
          headers: { 'X-CSRFToken': getCookie('csrftoken') }, // Assuming getCookie is defined
        }
      );
      toast.dismiss('rescan-start');
      setActiveTaskId(response.data.task_id); // This task is for the `process_repository` job
    } catch (error) {
      toast.dismiss('rescan-start');
      toast.error("Failed to start repository re-scan.");
      setWorkflowStep('needs_rescan');
    }
  }, [repoId]);

  // --- Step 3: Generate the Final README ---
  const handleGenerateReadme = useCallback(async () => {
    setIsLoading(true);
    setComponentState('generating');
    setReadmeContent(""); // Clear old content and prepare for streaming
    toast.info(`Helix is generating a README for '${modulePath.trim() || "the entire repository"}'...`);

    let generationSuccess = false;
    // This logic is from our previous implementation and remains the same
    try {
      const response = await fetch(`http://localhost:8000/api/v1/repositories/${repoId}/generate-module-workflow/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') || '' },
        body: JSON.stringify({ path: modulePath.trim() }),
      });
      if (!response.ok || !response.body) throw new Error("Failed to fetch stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        streamedText += decoder.decode(value, { stream: true });
        setReadmeContent(streamedText);
      }
      toast.success("README generated and saved successfully.");
      generationSuccess = true; // Mark as successful
    } catch (err) {
      toast.error("README Generation Failed");
      generationSuccess = false;
    } finally {
      setIsLoading(false);
      // --- THIS IS THE NEW LOGIC ---
      // If the generation was successful, automatically fetch the just-saved content
      // to ensure the display is in sync with the database.
      if (generationSuccess) {
        // We call the other handler function to "close the loop".
        // This avoids duplicating fetch logic.
        await handleFetchExistingReadme(modulePath.trim());
      } else {
        // If generation failed, revert to idle state.
        setComponentState('idle');
      }
      // --- END NEW LOGIC ---
    }
  }, [repoId, modulePath, handleFetchExistingReadme]);

  // --- Polling Logic for Both Task Types ---
  useEffect(() => {
    if (!activeTaskId) return;

    const intervalId = setInterval(() => {
      axios.get(`http://localhost:8000/api/v1/task-status/${activeTaskId}/`)
        .then(response => {
          const statusData: AsyncTaskStatus = response.data;
          setTaskStatus(statusData);
          toast.loading(statusData.message || 'Processing...', { id: activeTaskId, description: `Progress: ${statusData.progress}%` });

          if (statusData.status === 'SUCCESS' || statusData.status === 'FAILURE') {
            clearInterval(intervalId);
            toast.dismiss(activeTaskId);

            if (statusData.status === 'SUCCESS') {
              toast.success("Task completed successfully!");
              // Determine what to do next based on the current workflow step
              if (workflowStep === 'documenting') {
                setWorkflowStep('needs_rescan');
              } else if (workflowStep === 'rescanning') {
                setWorkflowStep('ready_to_generate');
              }
            } else {
              toast.error("Task failed.", { description: statusData.result?.error });
              setWorkflowStep('initial'); // Reset on failure
            }
            setActiveTaskId(null);
          }
        })
        .catch(() => {
          toast.error("Could not get task status.");
          clearInterval(intervalId);
          setActiveTaskId(null);
          setWorkflowStep('initial');
        });
    }, 2500);

    return () => clearInterval(intervalId);
  }, [activeTaskId, workflowStep]);

  const renderCurrentStep = () => {
    const isLoading = ['checking_coverage', 'documenting', 'rescanning', 'generating_readme'].includes(workflowStep);

    switch (workflowStep) {
      case 'initial':
        return <Button onClick={handleCheckCoverage} disabled={isLoading}><FileText className="mr-2 h-4 w-4" />1. Analyze Module</Button>;
      case 'checking_coverage':
        return <Button disabled={true}><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</Button>;
      case 'needs_documentation':
        return (
          <div className="text-center p-2 bg-amber-900/50 border border-amber-700 rounded-md">
            <p className="flex items-center justify-center"><AlertTriangle className="mr-2 h-4 w-4 text-amber-400" />Found {undocumentedCount} undocumented symbols.</p>
            <Button onClick={handleStartBatchDocumentation} className="mt-2" size="sm"><Sparkles className="mr-2 h-4 w-4" />2. Generate Docstrings</Button>
          </div>
        );
      case 'documenting':
        return <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating docstrings... {taskStatus?.progress || 0}%</p>;
      case 'needs_rescan':
        return (
          <div className="text-center p-2 bg-blue-900/50 border border-blue-700 rounded-md">
            <p className="flex items-center justify-center"><CheckCircle className="mr-2 h-4 w-4 text-blue-400" />Docstrings generated. Re-scan needed.</p>
            <Button onClick={handleRescanRepository} className="mt-2" size="sm"><History className="mr-2 h-4 w-4" />2.5. Re-scan Repository</Button>
          </div>
        );
      case 'rescanning':
        return <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Re-scanning repository... {taskStatus?.progress || 0}%</p>;
      case 'ready_to_generate':
        return <Button onClick={handleGenerateReadme} disabled={isLoading} variant="secondary"><FileText className="mr-2 h-4 w-4" />3. Generate README</Button>;
      case 'generating_readme':
        return <Button disabled={true}><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating README...</Button>;
      default:
        return null;
    }
  };
  const isBusy = componentState === 'fetching_existing' || isLoading;
  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Module/Repository README</CardTitle>
        <CardDescription>
          Check for a saved README or generate/regenerate one for any module path.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="Leave blank for root, or enter path..."
            value={modulePath}
            onChange={(e) => setModulePath(e.target.value)}
            disabled={isBusy}
          />
          <Button onClick={() => handleFetchExistingReadme(modulePath.trim())} disabled={isBusy} variant="outline">
            {componentState === 'fetching_existing' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Check
          </Button>
          <Button onClick={handleGenerateReadme} disabled={isBusy}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {readmeContent ? 'Regenerate' : 'Generate'}
          </Button>
        </div>

        {/* The display area logic remains the same */}
        {(componentState === 'displaying' || componentState === 'generating' || componentState === 'fetching_existing') && readmeContent !== null && (
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border border-border bg-background/50 p-4 mt-4">
            {(componentState === 'generating' || componentState === 'fetching_existing') && !readmeContent && <Loader2 className="h-6 w-6 animate-spin" />}
            <Markdown remarkPlugins={[remarkGfm]}>{readmeContent}</Markdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
};