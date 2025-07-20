import React, { createContext, useContext, useState, useEffect, useCallback, Dispatch, SetStateAction } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { type Repository, type CodeFile, type CodeSymbol, type GeneratedDoc } from '@/types';
import { getCookie } from '@/utils';

// 1. The complete interface for all shared state and functions
interface RepoContextType {
    // Repo and File state
    repo: Repository | null;
    isLoadingRepo: boolean;
    errorRepo: string | null;
    selectedFile: CodeFile | null;
    setSelectedFile: (file: CodeFile | null) => void;
    fileContent: string | null;
    isLoadingFileContent: boolean;
    fetchRepoDetails: () => void;
    // Symbol selection state
    selectedSymbol: CodeSymbol | null;
    setSelectedSymbol: (symbol: CodeSymbol | null) => void;

    // Batch file selection state
    selectedFilesForBatch: Set<number>;
    toggleFileForBatch: (fileId: number) => void;
    toggleAllFilesForBatch: () => void;
    clearBatchSelection: () => void;

    // Batch task state
    activeDocGenTaskId: string | null;
    activePRCreationTaskId: string | null;
    taskStatuses: Record<string, { status: string; message: any; progress: number; result_data?: any }>;
    handleBatchGenerateDocs: () => void;
    handleBatchCreatePR: () => void;

    // Per-symbol documentation state and handlers
    generatedDocs: Record<number, GeneratedDoc>;
    generatingDocId: number | null;
    savingDocId: number | null;
    handleGenerateDoc: (symbolId: number) => Promise<void>;
    handleSaveDoc: (symbolId: number, docToSave: string) => Promise<void>;
    setBatchSelection: (newSelection: Set<number>) => void;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export const RepoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { repoId } = useParams<{ repoId: string }>();

    // All state declarations
    const [repo, setRepo] = useState<Repository | null>(null);
    const [isLoadingRepo, setIsLoadingRepo] = useState(true);
    const [errorRepo, setErrorRepo] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<CodeSymbol | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
    const [selectedFilesForBatch, setSelectedFilesForBatch] = useState<Set<number>>(new Set());
    const [activeDocGenTaskId, setActiveDocGenTaskId] = useState<string | null>(null);
    const [activePRCreationTaskId, setActivePRCreationTaskId] = useState<string | null>(null);
    const [taskStatuses, setTaskStatuses] = useState<Record<string, any>>({});
    const [generatedDocs, setGeneratedDocs] = useState<Record<number, GeneratedDoc>>({});
    const [generatingDocId, setGeneratingDocId] = useState<number | null>(null);
    const [savingDocId, setSavingDocId] = useState<number | null>(null);

    // --- 2. Create the new handler ---
    const setBatchSelection = useCallback((newSelection: Set<number>) => {
        setSelectedFilesForBatch(newSelection);
    }, []);
    // Data Fetching Logic
    const fetchRepoDetails = useCallback(() => {
        if (repoId) {
            setIsLoadingRepo(true);
            setErrorRepo(null);
            axios.get(`/api/v1/repositories/${repoId}/`)
                .then(response => {
                    setRepo(response.data);
                })
                .catch(err => {
                    console.error("Error fetching repository details:", err);
                    setErrorRepo('Failed to load repository. It may not exist or you may not have permission.');
                    setRepo(null);
                })
                .finally(() => {
                    setIsLoadingRepo(false);
                });
        }
    }, [repoId]);

    useEffect(() => {
        fetchRepoDetails();
        setSelectedFile(null);
        setSelectedSymbol(null);
        setSelectedFilesForBatch(new Set());
    }, [repoId, fetchRepoDetails]);

    useEffect(() => {
        // If no file is selected, ensure content is null and do nothing.
        if (!selectedFile) {
            setFileContent(null);
            return;
        }

        // A file is selected, start the loading process.
        setIsLoadingFileContent(true);
        setFileContent(null); // Clear old content immediately

        axios.get(`/api/v1/files/${selectedFile.id}/content/`)
            .then(response => {
                // --- Robustly handle the response data ---
                let content: string | null = null;

                if (typeof response.data === 'string') {
                    // Case 1: The API returns the raw text content directly.
                    content = response.data;
                } else if (response.data && typeof response.data.content === 'string') {
                    // Case 2: The API returns a JSON object like { "content": "..." }.
                    content = response.data.content;
                } else {
                    // Case 3: The response is unexpected.
                    console.error("Unexpected API response structure for file content:", response.data);
                    content = `// Error: Received unexpected data structure for ${selectedFile.file_path}`;
                }

                setFileContent(content);
            })
            .catch(err => {
                console.error("Error fetching file content:", err);
                const errorMessage = err.response?.data?.error || err.message || "An unknown error occurred.";
                setFileContent(`// Error: Failed to load content for ${selectedFile.file_path}\n// ${errorMessage}`);
            })
            .finally(() => {
                setIsLoadingFileContent(false);
            });
    }, [selectedFile]);

    useEffect(() => {
        setSelectedSymbol(null);
    }, [selectedFile]);

    // Batch Selection Handlers
    const toggleFileForBatch = useCallback((fileId: number) => {
        setSelectedFilesForBatch(prev => {
            const newSet = new Set(prev);
            newSet.has(fileId) ? newSet.delete(fileId) : newSet.add(fileId);
            return newSet;
        });
    }, []);

    const toggleAllFilesForBatch = useCallback(() => {
        setSelectedFilesForBatch(prev => {
            if (repo && prev.size === repo.files.length) return new Set<number>();
            if (repo) return new Set(repo.files.map(f => f.id));
            return new Set<number>();
        });
    }, [repo]);

    const clearBatchSelection = useCallback(() => {
        setSelectedFilesForBatch(new Set());
    }, []);

    // Per-Symbol Documentation Handlers
    const handleGenerateDoc = useCallback(async (symbolId: number) => {
        setGeneratingDocId(symbolId);
        setGeneratedDocs(prev => ({ ...prev, [symbolId]: { markdown: '' } }));
        try {
            const response = await fetch(`/api/v1/functions/${symbolId}/generate-docstring/`, { credentials: 'include' });
            if (!response.body) throw new Error("Response has no body");
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                setGeneratedDocs(prev => ({ ...prev, [symbolId]: { markdown: (prev[symbolId]?.markdown || '') + chunk } }));
            }
        } catch (error) {
            toast.error("Failed to generate documentation.");
            setGeneratedDocs(prev => ({ ...prev, [symbolId]: { markdown: "// Error generating documentation." } }));
        } finally {
            setGeneratingDocId(null);
        }
    }, []);

    const handleSaveDoc = useCallback(async (symbolId: number, docToSave: string) => {
        setSavingDocId(symbolId);
        toast.info("Saving documentation...");
        try {
            await axios.post(`/api/v1/functions/${symbolId}/save-docstring/`,
                { documentation_text: docToSave },
                { headers: { 'X-CSRFToken': getCookie('csrftoken') } }
            );
            toast.success("Documentation saved successfully!");
            setGeneratedDocs(prev => {
                const newDocs = { ...prev };
                delete newDocs[symbolId];
                return newDocs;
            });
            fetchRepoDetails();
        } catch (err) {
            toast.error("Failed to save documentation.");
        } finally {
            setSavingDocId(null);
        }
    }, [fetchRepoDetails]);

    // Batch Action Task Handlers
    const handleBatchGenerateDocs = useCallback(() => {

        if (!repo || selectedFilesForBatch.size === 0 || activeDocGenTaskId || activePRCreationTaskId) {
            toast.warning("Cannot start batch generation.", { description: selectedFilesForBatch.size === 0 ? "No files are selected." : "Another batch operation is in progress." });
            return;
        }
        setActivePRCreationTaskId(null); // Clear other task
        setTaskStatuses({});
        toast.info("Initiating batch documentation generation...");
        axios.post(`/api/v1/repositories/${repo.id}/batch-generate-docs-selected/`, { file_ids: Array.from(selectedFilesForBatch) })
            .then(response => { if (response.data.task_id) setActiveDocGenTaskId(response.data.task_id); })
            .catch(err => toast.error("Failed to start batch generation.", { description: String(err) }));
    }, [repo, selectedFilesForBatch, activeDocGenTaskId, activePRCreationTaskId]);

    const handleBatchCreatePR = useCallback(() => {
        if (!repo || selectedFilesForBatch.size === 0 || activeDocGenTaskId || activePRCreationTaskId) {
            toast.warning("Cannot start PR creation.", { description: selectedFilesForBatch.size === 0 ? "No files are selected." : "Another batch operation is in progress." });
            return;
        }
        setActiveDocGenTaskId(null); // Clear other task
        setTaskStatuses({});
        toast.info("Initiating Pull Request creation...");
        axios.post(`/api/v1/repositories/${repo.id}/create-batch-pr-selected/`, { file_ids: Array.from(selectedFilesForBatch) })
            .then(response => { if (response.data.task_id) setActivePRCreationTaskId(response.data.task_id); })
            .catch(err => toast.error("Failed to start PR creation.", { description: String(err) }));
    }, [repo, selectedFilesForBatch, activeDocGenTaskId, activePRCreationTaskId]);

    // Polling Logic for Batch Tasks
    useEffect(() => {
        const activeTaskId = activeDocGenTaskId || activePRCreationTaskId;
        if (!activeTaskId) return;

        const intervalId = setInterval(() => {
            axios.get(`/api/v1/task-status/${activeTaskId}/`)
                .then(response => {
                    const taskData = response.data;

                    // Update the status, including the result_data
                    setTaskStatuses(prev => ({ ...prev, [activeTaskId]: taskData }));

                    if (taskData.status === 'SUCCESS' || taskData.status === 'FAILURE') {
                        clearInterval(intervalId);

                        if (taskData.status === 'SUCCESS') {
                            const prUrl = taskData.result_data?.pr_url;
                            toast.success(taskData.message || "Batch operation completed!", {
                                action: prUrl ? { label: "View PR", onClick: () => window.open(prUrl, '_blank') } : undefined,
                            });
                            if (taskData.task_name === 'BATCH_GENERATE_DOCS') refetchRepoDetails();
                            setTimeout(() => {
                                if (activeDocGenTaskId === activeTaskId) setActiveDocGenTaskId(null);
                                if (activePRCreationTaskId === activeTaskId) setActivePRCreationTaskId(null);
                            }, 4000);

                            // --- THIS IS THE KEY ---
                            // We do NOT clear the active task ID immediately.
                            // We leave it so the UI can read the final 'SUCCESS' status and its result.
                            // It will be cleared when the user starts a new task or navigates away.
                            // setActiveDocGenTaskId(null); // <-- REMOVE THIS
                            // setActivePRCreationTaskId(null); // <-- REMOVE THIS

                        } else { // FAILURE
                            toast.error(taskData.message || "Batch operation failed.");
                            // On failure, we can clear the task ID to allow retries.
                            if (activeDocGenTaskId === activeTaskId) setActiveDocGenTaskId(null);
                            if (activePRCreationTaskId === activeTaskId) setActivePRCreationTaskId(null);
                        }
                    }
                })
                .catch(() => {
                    toast.error("Failed to poll task status.");
                    clearInterval(intervalId);
                    // Also clear on error
                    if (activeDocGenTaskId === activeTaskId) setActiveDocGenTaskId(null);
                    if (activePRCreationTaskId === activeTaskId) setActivePRCreationTaskId(null);
                });
        }, 3000);

        return () => clearInterval(intervalId);
    }, [activeDocGenTaskId, activePRCreationTaskId, fetchRepoDetails]);

    // The final context value object provided to consumers
    const value: RepoContextType = {
        repo,
        isLoadingRepo,
        errorRepo,
        selectedFile,
        setSelectedFile,
        fileContent,
        isLoadingFileContent,
        fetchRepoDetails: fetchRepoDetails,
        selectedSymbol,
        setSelectedSymbol,
        selectedFilesForBatch,
        toggleFileForBatch,
        toggleAllFilesForBatch,
        clearBatchSelection,
        activeDocGenTaskId,
        activePRCreationTaskId,
        taskStatuses,
        handleBatchGenerateDocs,
        handleBatchCreatePR,
        generatedDocs,
        generatingDocId,
        savingDocId,
        handleGenerateDoc,
        handleSaveDoc,
        setBatchSelection,
    };

    return <RepoContext.Provider value={value}>{children}</RepoContext.Provider>;
};

// Custom hook for easy consumption
export const useRepo = (): RepoContextType => {
    const context = useContext(RepoContext);
    if (context === undefined) {
        throw new Error('useRepo must be used within a RepoProvider');
    }
    return context;
};