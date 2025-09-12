import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { type Repository, type CodeFile, type CodeSymbol, type GeneratedDoc, type LiteCodeFile } from '@/types';
import { getCookie, updateDocstringInAst } from '@/utils';
export interface StagedChange {
    fileId: number;
    newContent: string;
}
// 1. The complete interface for all shared state and functions
interface RepoContextType {
    // Repo and File state
    repo: Repository | null; // This will now contain LiteCodeFile[]
    isLoadingRepo: boolean;
    errorRepo: string | null;
    selectedFile: CodeFile | null; // This will always be the FULL CodeFile object
    setSelectedFile: (file: LiteCodeFile | null) => void; // Now accepts a LiteCodeFile
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
    setBatchSelection: (newSelection: Set<number>) => void;

    // Batch task state (no changes needed here)
    activeDocGenTaskId: string | null;
    activePRCreationTaskId: string | null;
    taskStatuses: Record<string, { status: string; message: any; progress: number; result_data?: any }>;
    handleBatchGenerateDocs: () => void;
    handleBatchCreatePR: () => void;

    // Per-symbol documentation state and handlers (no changes needed here)
    generatedDocs: Record<number, GeneratedDoc>;
    generatingDocId: number | null;
    savingDocId: number | null;
    handleGenerateDoc: (symbolId: number) => Promise<void>;
    handleSaveDoc: (symbolId: number, docToSave: string) => Promise<void>;
    selectedFolderPath: string | null;
    setSelectedFolderPath: (path: string | null) => void;
    stagedChanges: Map<number, StagedChange>; // Map<fileId, StagedChange>
    addStagedChange: (fileId: number, newContent: string) => void;
    discardStagedChange: (fileId: number) => void;
    discardAllStagedChanges: () => void;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export const RepoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { repoId } = useParams<{ repoId: string }>();

    // --- State Declarations ---
    const [repo, setRepo] = useState<Repository | null>(null);
    const [isLoadingRepo, setIsLoadingRepo] = useState(true);
    const [errorRepo, setErrorRepo] = useState<string | null>(null);

    // This map will act as our client-side cache for full file data
    const [fullFilesData, setFullFilesData] = useState<Record<number, CodeFile>>({});

    const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
    const [selectedSymbol, setSelectedSymbol] = useState<CodeSymbol | null>(null);
    const [fileContent, setFileContent] = useState<string | null>(null);
    const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);

    // All other state (batch selection, tasks, docs) remains the same
    const [selectedFilesForBatch, setSelectedFilesForBatch] = useState<Set<number>>(new Set());
    const [activeDocGenTaskId, setActiveDocGenTaskId] = useState<string | null>(null);
    const [activePRCreationTaskId, setActivePRCreationTaskId] = useState<string | null>(null);
    const [taskStatuses, setTaskStatuses] = useState<Record<string, any>>({});
    const [generatedDocs, setGeneratedDocs] = useState<Record<number, GeneratedDoc>>({});
    const [generatingDocId, setGeneratingDocId] = useState<number | null>(null);
    const [savingDocId, setSavingDocId] = useState<number | null>(null);
    const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
    const [stagedChanges, setStagedChanges] = useState<Map<number, StagedChange>>(new Map());

    const addStagedChange = useCallback((fileId: number, newContent: string) => {
        setStagedChanges(prev => {
            const newMap = new Map(prev);
            newMap.set(fileId, { fileId, newContent });
            return newMap;
        });
    }, []);

    const discardStagedChange = useCallback((fileId: number) => {
        setStagedChanges(prev => {
            const newMap = new Map(prev);
            newMap.delete(fileId);
            return newMap;
        });
    }, []);

    const discardAllStagedChanges = useCallback(() => {
        setStagedChanges(new Map());
    }, []);
    const handleSetSelectedFolderPath = (path: string | null) => {
        setSelectedFolderPath(path);
        if (path) setSelectedFile(null);
    };
    // --- 2. Create the new handler ---
    const setBatchSelection = useCallback((newSelection: Set<number>) => {
        setSelectedFilesForBatch(newSelection);
    }, []);
    // Data Fetching Logic
    const fetchRepoDetails = useCallback(() => {
        if (repoId) {
            setIsLoadingRepo(true);
            setErrorRepo(null);
            // This now fetches the "lite" repository data with only file paths
            axios.get(`/api/v1/repositories/${repoId}/`)
                .then(response => {
                    setRepo(response.data);
                })
                .catch(err => {
                    console.error("Error fetching repository details:", err);
                    setErrorRepo('Failed to load repository.');
                    setRepo(null);
                })
                .finally(() => {
                    setIsLoadingRepo(false);
                });
        }
    }, [repoId]);
    const handleSetSelectedFile = useCallback((file: LiteCodeFile | null) => {
        if (!file) {
            setSelectedFile(null);
            setFileContent(null); // Also clear content when deselecting
            return;
        }

        const fetchContent = (fileToFetch: CodeFile) => {
            setIsLoadingFileContent(true);
            setFileContent(null);
            axios.get(`/api/v1/files/${fileToFetch.id}/content/`)
                .then(response => setFileContent(response.data))
                .catch(() => setFileContent("// Error loading file content."))
                .finally(() => setIsLoadingFileContent(false));
        };

        // Check our client-side cache first
        if (fullFilesData[file.id]) {
            const cachedFile = fullFilesData[file.id];
            setSelectedFile(cachedFile);
            fetchContent(cachedFile); // Fetch content for the cached file
        } else {
            // If not in cache, fetch the full details first
            axios.get(`/api/v1/files/${file.id}/`)
                .then(response => {
                    const fullFileData: CodeFile = response.data;
                    setFullFilesData(prev => ({ ...prev, [file.id]: fullFileData }));
                    setSelectedFile(fullFileData);
                    // THEN, fetch the content for the newly fetched file
                    fetchContent(fullFileData);
                })
                .catch(err => {
                    console.error(`Failed to fetch full details for file ${file.id}:`, err);
                    toast.error(`Could not load details for ${file.file_path}`);
                });
        }
    }, [fullFilesData]);

    useEffect(() => {
        fetchRepoDetails();
        setFullFilesData({});
        setSelectedFile(null);
        setSelectedSymbol(null);
        setSelectedFilesForBatch(new Set());
    }, [repoId, fetchRepoDetails]);

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
        console.log('handleGenerateDoc called for symbolId:', symbolId);
        setGeneratingDocId(symbolId);

        // Use selectedFile which is the full CodeFile object
        if (!selectedFile) {
            console.error('No file selected');
            toast.error("No file selected.");
            setGeneratingDocId(null);
            return;
        }

        // Find the symbol in the selected file
        const symbol = selectedFile.symbols.find(s => s.id === symbolId) ||
            selectedFile.classes.flatMap(c => c.methods).find(m => m.id === symbolId);

        if (!symbol) {
            console.error('Could not find symbol:', { symbolId, selectedFile });
            toast.error("Could not find the symbol to document.");
            setGeneratingDocId(null);
            return;
        }

        // Get the current content (either staged or original)
        const currentContent = stagedChanges.get(selectedFile.id)?.newContent || fileContent;
        if (currentContent === null) {
            console.error('File content is not available');
            toast.error("File content is not available.");
            setGeneratingDocId(null);
            return;
        }

        try {
            console.log('Making API call to generate docstring for symbol:', symbol.name);
            const response = await fetch(`/api/v1/functions/${symbolId}/generate-docstring/`, { credentials: 'include' });
            console.log('API response status:', response.status);

            if (!response.body) throw new Error("Response has no body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let generatedDocstring = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                generatedDocstring += decoder.decode(value, { stream: true });
            }

            console.log('Generated docstring:', generatedDocstring);

            // --- THE MAGIC HAPPENS HERE ---
            // Use an AST utility to inject the new docstring into the current content
            const className = selectedFile.classes.find(c => c.methods.some(m => m.id === symbolId))?.name;
            const newFileContent = updateDocstringInAst(currentContent, symbol.name, generatedDocstring, className);

            // Add the modified file content to our staging area
            addStagedChange(selectedFile.id, newFileContent);

            // Store the generated documentation in state so it shows in the UI
            setGeneratedDocs(prev => ({
                ...prev,
                [symbolId]: {
                    id: symbolId,
                    markdown: generatedDocstring,
                    created_at: new Date().toISOString()
                }
            }));

            toast.success(`Docstring for ${symbol.name} generated and staged.`);

        } catch (error) {
            console.error('Error generating documentation:', error);
            toast.error("Failed to generate documentation.");
        } finally {
            setGeneratingDocId(null);
        }
    }, [selectedFile, fileContent, stagedChanges, addStagedChange]);

    const handleSaveDoc = useCallback(async (symbolId: number, docToSave: string) => {
        setSavingDocId(symbolId);
        toast.info("Saving documentation...");
        try {
            await axios.post(`/api/v1/functions/${symbolId}/save-docstring/`,
                { documentation_text: docToSave },
                { headers: { 'X-CSRFToken': getCookie('csrftoken') } }
            );
            toast.success("Documentation saved successfully!");

            // Clear the generated doc since it's now saved
            setGeneratedDocs(prev => {
                const newDocs = { ...prev };
                delete newDocs[symbolId];
                return newDocs;
            });

            // Update the selectedFile with the new docstring to avoid needing a reload
            if (selectedFile) {
                const updatedFile = { ...selectedFile };

                // Update the symbol in the symbols array
                updatedFile.symbols = updatedFile.symbols.map(symbol =>
                    symbol.id === symbolId
                        ? { ...symbol, existing_docstring: docToSave, documentation_status: 'FRESH' }
                        : symbol
                );

                // Update methods in classes if it's a method
                updatedFile.classes = updatedFile.classes.map(cls => ({
                    ...cls,
                    methods: cls.methods.map(method =>
                        method.id === symbolId
                            ? { ...method, existing_docstring: docToSave, documentation_status: 'FRESH' }
                            : method
                    )
                }));

                setSelectedFile(updatedFile);
            }

            // Also fetch updated repo details for dashboard
            fetchRepoDetails();
        } catch (err) {
            toast.error("Failed to save documentation.");
        } finally {
            setSavingDocId(null);
        }
    }, [fetchRepoDetails, selectedFile]);

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
                            if (taskData.task_name === 'BATCH_GENERATE_DOCS') fetchRepoDetails();
                            setTimeout(() => {
                                if (activeDocGenTaskId === activeTaskId) setActiveDocGenTaskId(null);
                                if (activePRCreationTaskId === activeTaskId) setActivePRCreationTaskId(null);
                            }, 4000);

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
        setSelectedFile: handleSetSelectedFile, // Use the new smart handler
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
        selectedFolderPath, setSelectedFolderPath,
        setBatchSelection,
        stagedChanges,
        addStagedChange,
        discardStagedChange,
        discardAllStagedChanges,
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