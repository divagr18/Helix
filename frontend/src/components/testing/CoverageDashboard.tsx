// src/components/testing/CoverageDashboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { FileUploadDropzone } from '@/components/ui/FileDropZone';
import { CoverageVisualizer } from './CoverageVisualizer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { TreeNode } from '@/utils/tree';
import { type CoverageReport } from '@/types'; 
// ... (CoverageReport interface) ...

export const CoverageDashboard = () => {
    const { activeRepository } = useWorkspaceStore();
    const [report, setReport] = useState<CoverageReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    const fetchLatestReport = useCallback(() => {
        // --- THIS IS THE FIX ---
        // We must handle the case where there is no active repository.
        if (activeRepository) {
            setIsLoading(true);
            setError(null);
            axios.get(`/api/v1/repositories/${activeRepository.id}/coverage/latest/`)
                .then(response => {
                    setReport(response.data);
                })
                .catch(err => {
                    if (err.response && err.response.status === 404) {
                        setReport(null);
                    } else {
                        console.error("Failed to fetch coverage report:", err);
                        setError("An error occurred while fetching the coverage report.");
                    }
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            // If there's no repo, we are not loading anything.
            setIsLoading(false);
            setReport(null); // Ensure no old report data is shown
        }
        // --- END FIX ---
    }, [activeRepository]);

    // 1) When you deselect (selectedNode → null), clear everything:
useEffect(() => {
  if (!selectedNode) {
    setFileContent(null);
    setIsLoadingContent(false);
    console.log("[Coverage] deselected → clearing content");
  }
}, [selectedNode]);

// 2) When a file node is selected AND the report is ready, fetch it:
useEffect(() => {
  if (selectedNode?.type !== 'file' || !report) return;

  const coverageInfo = report.file_coverages.find(
    (fc) => fc.file_path === selectedNode.path
  );
  const fileId = coverageInfo?.code_file_id;
  if (!fileId) {
    setFileContent("// Could not determine file ID for this path.");
    return;
  }

  setIsLoadingContent(true);
  axios
    .get(`/api/v1/files/${fileId}/content/`)
    .then((res) => {
      console.log("[Coverage] raw response.data:", res.data);
      // Try to pull out the text from known shapes:
      let text: string;
      if (typeof res.data === "string") {
        // API returned raw text
        text = res.data;
      } else if (typeof res.data.content === "string") {
        // { content: "..." }
        text = res.data.content;
      } else if (res.data.file && typeof res.data.file.content === "string") {
        // { file: { content: "..." } }
        text = res.data.file.content;
      } else {
        // fallback: serialize whole object
        text = JSON.stringify(res.data, null, 2);
      }
      console.log("[Coverage] extracted text length:", text.length);
      setFileContent(text);
    })
    .catch((err) => {
      console.error("[Coverage] error loading content:", err);
      setFileContent("// Error loading file content.");
    })
    .finally(() => {
      setIsLoadingContent(false);
    });
}, [selectedNode, report]);





    useEffect(() => {
        fetchLatestReport();
    }, [fetchLatestReport]);

    const handleUploadSuccess = () => {
        toast.info("Processing report...", { description: "The dashboard will refresh automatically." });
        setTimeout(() => {
            fetchLatestReport();
        }, 3000);
    };
    

    // --- REFINED RENDER LOGIC ---
    // First, handle the loading state. This is the highest priority.
    if (isLoading) {
        return <Skeleton className="h-[80vh] w-full m-6" />;
    }

    // After loading, if there's no active repo, show a clear message.
    if (!activeRepository) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Please select a repository from the header to view its test coverage.</p>
            </div>
        );
    }

    // After loading, if there was an error, show it.
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-destructive">{error}</p>
                <Button onClick={fetchLatestReport} variant="outline" className="mt-4">Try Again</Button>
            </div>
        );
    }

    // If we are done loading and have a repo, render the main content.
    return (
        <div className="h-full flex flex-col">
            {report ? (
                <div className="flex-grow min-h-0">
                    {/* Pass fetchLatestReport as the onUploadNew handler */}
                    <CoverageVisualizer report={report} onUploadNew={fetchLatestReport} selectedNode={selectedNode}
                        onSelectNode={setSelectedNode}
                        fileContent={fileContent}
                        isLoadingContent={isLoadingContent} />
                </div>
            ) : (
                <div className="text-center p-8 mt-8 border-dashed border-2 rounded-lg max-w-2xl mx-auto">
                    <h3 className="text-xl font-semibold">No Coverage Report Found</h3>
                    <p className="text-muted-foreground mt-2">
                        Generate a `coverage.xml` report from your test suite and upload it to get started.
                    </p>
                    <FileUploadDropzone
                        repoId={activeRepository.id}
                        onUploadSuccess={handleUploadSuccess}
                    />
                </div>
            )}
        </div>
    );
};