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

// Define a more specific type for the report data for better type safety
interface CoverageReport {
    id: number;
    commit_hash: string;
    uploaded_at: string;
    overall_coverage: number;
    file_coverages: any[]; // Define this more strictly if you can
}

export const CoverageDashboard = () => {
    const [isLoadingReport, setIsLoadingReport] = useState(true);

    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const { activeRepository } = useWorkspaceStore();
    const [report, setReport] = useState<CoverageReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Use useCallback to memoize the fetching function
    const fetchLatestReport = useCallback(() => {
        if (activeRepository) {
            setIsLoading(true);
            setError(null);
            axios.get(`/api/v1/repositories/${activeRepository.id}/coverage/latest/`)
                .then(response => {
                    setReport(response.data);
                })
                .catch(err => {
                    // If the error is a 404, it just means no report exists, which is fine.
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
        }
    }, [activeRepository]);

    // Fetch the report when the component mounts or the active repo changes
    useEffect(() => {
        fetchLatestReport();
    }, [fetchLatestReport]);
    useEffect(() => {
        if (selectedNode && selectedNode.type === 'file' && report) {
            const coverageInfo = report.file_coverages.find(fc => fc.file_path === selectedNode.path);
            const fileId = coverageInfo?.code_file_id;

            if (fileId) {
                setIsLoadingContent(true);
                setFileContent(null);
                axios.get(`/api/v1/files/${fileId}/content/`)
                    .then(response => setFileContent(response.data.content))
                    .catch(() => setFileContent("// Error loading file content."))
                    .finally(() => setIsLoadingContent(false));
            }
        }
    }, [selectedNode, report]);
    // This function will be passed to the dropzone to trigger a refresh after a successful upload
    const handleUploadSuccess = () => {
        // Give the backend a moment to process before refetching
        toast.info("Processing report...", { description: "The dashboard will refresh automatically." });
        setTimeout(() => {
            fetchLatestReport();
        }, 3000); // 3-second delay as a simple polling mechanism
    };
    if (isLoadingReport) return <Skeleton className="h-[80vh] w-full" />;
    if (error) return <p>{error}</p>;

    // --- Render Logic ---

    // If we have a report, show the visualizer. Otherwise, show the uploader.
    return (
        <div className="h-full flex flex-col">
            {report ? (
                <div className="flex-grow min-h-0">
                    <CoverageVisualizer
                        report={report}
                        onUploadNew={fetchLatestReport}
                        // Pass down the state and the setter function
                        selectedNode={selectedNode}
                        onSelectNode={setSelectedNode}
                        fileContent={fileContent}
                        isLoadingContent={isLoadingContent}
                    />
                </div>
            ) : (
                <div className="text-center p-8 mt-8 border-dashed border-2 rounded-lg max-w-2xl mx-auto">
                    <h3 className="text-xl font-semibold">No Coverage Report Found</h3>
                    <p className="text-muted-foreground mt-2">
                        Generate a `coverage.xml` report from your test suite (e.g., using `pytest-cov`) and upload it to get started.
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