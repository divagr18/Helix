import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner'; // <-- Import toast

// Added FaSpinner for loading state
import { Button } from '@/components/ui/button';
import { getCookie } from '../utils';
import { CodeEditorPanel } from '../components/repo-detail/CodeViewerPanel';
import { AnalysisPanel } from '../components/repo-detail/AnalysisPanel';
import { FileTreePanel } from '../components/repo-detail/FileTreePanel';
import { BatchActionsPanel } from '../components/repo-detail/BatchActionsPanel';
import { OrphanSymbolsPanel, type OrphanSymbolDisplayItem } from '../components/repo-detail/OrphanSymbolsPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutGrid, History, Share2 } from 'lucide-react';
import { ActivityFeed } from '@/components/repo-detail/ActivityFeed';
// --- Type Definitions ---
interface CodeSymbol {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
  documentation: string | null;
  content_hash: string | null;
  documentation_hash: string | null;
  documentation_status: string | null;
  is_orphan?: boolean; // <<<< ADD THIS (optional if not always present)
  // For context when listing orphans:
  filePath?: string;
  className?: string;
  loc?: number | null;
  cyclomatic_complexity?: number | null;
}

interface CodeClass {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
  structure_hash: string | null;
  methods: CodeSymbol[];
}

export interface CodeFile {
  id: number;
  file_path: string;
  structure_hash: string | null;
  symbols: CodeSymbol[];
  classes: CodeClass[];
}

interface Repository {
  id: number;
  full_name: string;
  status: string;
  root_merkle_hash: string | null;
  files: CodeFile[];
}

export function RepoDetailPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const [repo, setRepo] = useState<Repository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getActiveTab = () => {
    if (location.pathname.endsWith('/architecture')) return 'architecture';
    if (location.pathname.endsWith('/activity')) return 'activity';
    return 'files';
  }

  const [selectedFile, setSelectedFile] = useState<CodeFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);
  const [savingDocId, setSavingDocId] = useState<number | null>(null); // New state for save loading
  const [creatingPRFileId, setCreatingPRFileId] = useState<number | null>(null);
  const [selectedFilesForBatch, setSelectedFilesForBatch] = useState<Set<number>>(new Set());
  const [selectAllFiles, setSelectAllFiles] = useState<boolean>(false); // Default to all files selected
  const [batchProcessingRepoId, setBatchProcessingRepoId] = useState<number | null>(null);
  const [batchRepoMessage, setBatchRepoMessage] = useState<string | null>(null);
  const [creatingBatchPRRepoId, setCreatingBatchPRRepoId] = useState<number | null>(null);
  const [batchPRMessage, setBatchPRMessage] = useState<string | null>(null);
  const [generatingDocId, setGeneratingDocId] = useState<number | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<Record<number, string>>({});
  const [batchProcessingFileId, setBatchProcessingFileId] = useState<number | null>(null);
  const [batchMessages, setBatchMessages] = useState<Record<number, string>>({});
  const [prMessages, setPrMessages] = useState<Record<number, string>>({});
  const [activeDocGenTaskId, setActiveDocGenTaskId] = useState<string | null>(null);
  const [docGenTaskMessage, setDocGenTaskMessage] = useState<string | null>(null);
  const [docGenTaskProgress, setDocGenTaskProgress] = useState<number>(0); // Optional progress
  const [showOrphanList, setShowOrphanList] = useState<boolean>(false);
  const [activePRCreationTaskId, setActivePRCreationTaskId] = useState<string | null>(null);
  const [prCreationTaskMessage, setPRCreationTaskMessage] = useState<string | null>(null);
  const [prCreationTaskProgress, setPRCreationTaskProgress] = useState<number>(0); // Optional progress
  const [prURL, setPrURL] = useState<string | null>(null); // To store the PR URL
  const isAnyFileSpecificActionInProgress = batchProcessingFileId !== null || creatingPRFileId !== null;
  const isAnyGlobalBatchActionInProgress = activeDocGenTaskId !== null || activePRCreationTaskId !== null;
  const isAnyOperationInProgressForFileTree = isAnyFileSpecificActionInProgress || isAnyGlobalBatchActionInProgress;

  const [modifiedFileContent, setModifiedFileContent] = useState<string | null>(null);

  // --- YOUR CORRECT API CALL LOGIC ---
  const orphanSymbolsList = useMemo(() => {
    if (!repo) return [];
    const orphans: Array<CodeSymbol & { filePath: string; className?: string }> = [];
    repo.files.forEach(file => {
      file.symbols.forEach(sym => {
        if (sym.is_orphan) {
          orphans.push({ ...sym, filePath: file.file_path });
        }
      });
      file.classes.forEach(cls => {
        cls.methods.forEach(method => {
          if (method.is_orphan) {
            orphans.push({ ...method, filePath: file.file_path, className: cls.name });
          }
        });
      });
    });
    // Sort for consistent display, e.g., by file path then by name
    orphans.sort((a, b) => {
      if (a.filePath.localeCompare(b.filePath) !== 0) {
        return a.filePath.localeCompare(b.filePath);
      }
      return a.name.localeCompare(b.name);
    });
    return orphans;
  }, [repo]);

  // This function will be passed to the editor to update our state
  const handleContentChange = (newContent: string | undefined) => {
    // The editor's value can be undefined. We handle it here.
    // We can store `undefined` or default to an empty string. Storing `null` is also an option.
    setModifiedFileContent(newContent ?? '');
  };

  // A new function to handle saving the changes
  const handleSaveChanges = () => {
    if (!selectedFile || modifiedFileContent === null) return;

    toast.info("Saving changes...");
    // This requires a new backend endpoint: PUT or POST /api/v1/files/<id>/content/
    axios.put(`/api/v1/files/${selectedFile.id}/content/`, { content: modifiedFileContent }, { // The configuration object
      withCredentials: true,
      headers: {
        'X-CSRFToken': getCookie('csrftoken'), // Get the token from cookies
      },
    })
      .then(() => {
        toast.success("File saved successfully!");
        // Update the "original" content state to match the new saved state
        setFileContent(modifiedFileContent);
      })
      .catch(err => {
        toast.error("Failed to save file.", { description: err.message });
      });
  };

  // Determine if there are unsaved changes
  const hasUnsavedChanges = fileContent !== null && modifiedFileContent !== null && fileContent !== modifiedFileContent;
  const handleCreateBatchPRForRepo = () => {
    // Guard conditions: ensure repo is loaded, files are selected, and no other batch task is active
    if (!repo || selectedFilesForBatch.size === 0 || activePRCreationTaskId !== null || activeDocGenTaskId !== null) {
      if (selectedFilesForBatch.size === 0) {
        setPRCreationTaskMessage("No files selected for PR. Please select files that have updated documentation.");
      } else if (activeDocGenTaskId !== null) {
        setPRCreationTaskMessage("Documentation generation is currently in progress. Please wait.");
      } else if (activePRCreationTaskId !== null) {
        setPRCreationTaskMessage("A PR creation process is already in progress.");
      }
      return;
    }

    // Set initial state for PR creation
    setPRCreationTaskMessage(`Initiating PR creation for ${selectedFilesForBatch.size} selected file(s)...`);
    setPRCreationTaskProgress(0); // Reset progress
    setDocGenTaskMessage(null);    // Clear any message from the doc generation task
    setPrURL(null);               // Clear any previous PR URL

    axios.post(
      `/api/v1/repositories/${repo.id}/create-batch-pr-selected/`,
      { file_ids: Array.from(selectedFilesForBatch) },
      {
        withCredentials: true,
        headers: { 'X-CSRFToken': getCookie('csrftoken') }, // Assuming getCookie is defined
      }
    )
      .then(response => {
        console.log("Batch PR creation initiated:", response.data);
        if (response.data.task_id) {
          setActivePRCreationTaskId(response.data.task_id); // This triggers the polling useEffect
          // The polling useEffect will now be responsible for updating prCreationTaskMessage further
          setPRCreationTaskMessage(response.data.message || `PR creation started (Task ID: ${response.data.task_id}). Polling for status...`);
        } else {
          setPRCreationTaskMessage("Failed to get a valid task ID for PR creation from the server.");
          setActivePRCreationTaskId(null); // Ensure no polling starts if task_id is missing
        }
      })
      .catch(error => {
        console.error("Error initiating batch PR creation:", error);
        const errorMsg = error.response?.data?.error || `Failed to start batch PR creation for selected files.`;
        setPRCreationTaskMessage(errorMsg);
        setActivePRCreationTaskId(null); // Clear active task ID on immediate failure
      });
  };

  const pollTaskStatus = async (
    taskId: string,
    setMessage: React.Dispatch<React.SetStateAction<string | null>>,
    setProgress: React.Dispatch<React.SetStateAction<number>>,
    setFinalActiveTaskId: React.Dispatch<React.SetStateAction<string | null>>, // To clear the active task ID
    onSuccess?: (data: any) => void, // Optional callback on success
    onFailure?: (data: any) => void  // Optional callback on failure
  ) => {
    try {
      const response = await axios.get(`/api/v1/task-status/${taskId}/`, {
        withCredentials: true,                 // ← send session+csrf cookies
        headers: {
          'X-CSRFToken': getCookie('csrftoken') // ← required for PATCH
        }
      });
      const taskData = response.data;

      setMessage(taskData.message || `Status: ${taskData.get_status_display || taskData.status}`);
      setProgress(taskData.progress || 0);

      if (taskData.status === 'SUCCESS') {
        console.log(`Task ${taskId} SUCCESS:`, taskData);
        setFinalActiveTaskId(null); // Stop polling
        setProgress(100);
        if (onSuccess) onSuccess(taskData.result_data);
        // Optionally, trigger a refetch of repo details if docs were updated
        if (taskData.task_name === 'BATCH_GENERATE_DOCS') {
          fetchRepoDetails(); // Assuming fetchRepoDetails is defined
        }
        return true; // Task finished
      } else if (taskData.status === 'FAILURE') {
        console.error(`Task ${taskId} FAILURE:`, taskData);
        setMessage(taskData.message || `Task failed. Task ID: ${taskId}`);
        setFinalActiveTaskId(null); // Stop polling
        if (onFailure) onFailure(taskData.result_data);
        return true; // Task finished
      }
      return false; // Task still in progress or pending
    } catch (error) {
      console.error(`Error polling task ${taskId}:`, error);
      setMessage(`Error polling task status. Task ID: ${taskId}`);
      setFinalActiveTaskId(null); // Stop polling on error
      if (onFailure) onFailure(null);
      return true; // Task finished (due to error)
    }
  };

  // --- useEffect for Polling Batch Doc Generation Task ---
  // Re-run if activeDocGenTaskId changes

  // --- useEffect for Polling Batch PR Creation Task ---
  const getLanguage = (filePath: string) => {
    const extension = filePath.split('.').pop() || '';
    if (extension === 'py') return 'python';
    if (extension === 'js') return 'javascript';
    if (extension === 'ts') return 'typescript';
    return 'plaintext';
  };
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (activePRCreationTaskId) {
      setPRCreationTaskProgress(0); // Reset progress
      setPrURL(null);

      const poll = async () => {
        const finished = await pollTaskStatus(
          activePRCreationTaskId,
          setPRCreationTaskMessage,
          setPRCreationTaskProgress,
          setActivePRCreationTaskId,
          (resultData) => { // onSuccess
            console.log("PR Creation Success Result:", resultData);
            if (resultData && resultData.pr_url) {
              setPrURL(resultData.pr_url);
              setPRCreationTaskMessage(
                <>
                  Pull Request created successfully!
                  URL: <a href={resultData.pr_url} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff' }}>{resultData.pr_url}</a>
                </>
              );
            } else if (resultData && resultData.message) {
              setPRCreationTaskMessage(resultData.message);
            }
            else {
              setPRCreationTaskMessage("Pull Request creation completed successfully.");
            }
          },
          (resultData) => { // onFailure
            console.log("PR Creation Failure Result:", resultData);
            if (resultData && resultData.message) {
              setPRCreationTaskMessage(`Failed: ${resultData.message}`);
            } else {
              setPRCreationTaskMessage("Pull Request creation failed.");
            }
          }
        );
        if (finished) {
          clearInterval(intervalId);
        }
      };
      poll();
      intervalId = setInterval(poll, 7000); // Poll PR task a bit less frequently
    }
    return () => clearInterval(intervalId);
  }, [activePRCreationTaskId]);
  // --- Handler for "Create PR for Selected Files" Button ---

  const handleBatchGenerateDocsForRepo = () => {
    if (!repo || selectedFilesForBatch.size === 0 || batchProcessingRepoId !== null || creatingBatchPRRepoId !== null) {
      if (selectedFilesForBatch.size === 0) setDocGenTaskMessage("No files selected.");
      else setDocGenTaskMessage("Another batch operation is in progress.");
      return;
    }

    setDocGenTaskMessage(`Initiating batch doc generation for ${selectedFilesForBatch.size} selected file(s)...`);
    setDocGenTaskProgress(0);
    setPRCreationTaskMessage(null); // Clear other task's message
    setPrURL(null);

    axios.post(
      `/api/v1/repositories/${repo.id}/batch-generate-docs-selected/`,
      { file_ids: Array.from(selectedFilesForBatch) }, // Send array of selected file IDs
      {
        withCredentials: true,                 // ← send session+csrf cookies
        headers: {
          'X-CSRFToken': getCookie('csrftoken') // ← required for PATCH
        }
      }
    )
      .then(response => {
        console.log("Batch doc generation initiated:", response.data);
        if (response.data.task_id) {
          setActiveDocGenTaskId(response.data.task_id); // <<<< SET ACTIVE TASK ID
          setDocGenTaskMessage(response.data.message || `Batch generation started (Task ID: ${response.data.task_id}). Polling for status...`);
        } else {
          setDocGenTaskMessage("Failed to get task ID for batch generation.");
        }
      })
      .catch(error => {
        // ... (existing error handling, update setDocGenTaskMessage) ...
        const errorMsg = error.response?.data?.error || `Failed to start batch generation.`;
        setDocGenTaskMessage(errorMsg);
        setActiveDocGenTaskId(null); // Clear on immediate failure
      });
  };
  const handleBatchGenerateDocsForFile = (fileId: number, fileName: string) => {
    if (batchProcessingFileId === fileId) return; // Already processing this file

    setBatchProcessingFileId(fileId);
    setBatchMessages(prev => ({ ...prev, [fileId]: `Initiating batch doc generation for ${fileName}...` }));

    axios.post( // Use POST as it's an action
      `/api/v1/files/${fileId}/batch-generate-docs/`,
      {},
      {
        withCredentials: true,                 // ← send session+csrf cookies
        headers: {
          'X-CSRFToken': getCookie('csrftoken') // ← required for PATCH
        }
      }
    )
      .then(response => {
        console.log("Batch doc generation initiated:", response.data);
        setBatchMessages(prev => ({
          ...prev,
          [fileId]: `Batch generation started (Task ID: ${response.data.task_id}). Docs will be updated in the database.`
        }));
        setTimeout(() => {
          setBatchProcessingFileId(null);
          // Optionally clear the message or set a "check back later" message
          // setBatchMessages(prev => ({ ...prev, [fileId]: `Processing for ${fileName} dispatched. Refresh to see updates.` }));
        }, 10000); // Re-enable button after 10 seconds (adjust as needed)

        // To see immediate changes, we'd ideally refetch repo details after the task is *known* to be complete.
        // This requires a task status tracking system. For now, user will refresh.
      })
      .catch(error => {
        console.error("Error initiating batch doc generation:", error);
        const errorMsg = error.response?.data?.error || `Failed to start batch generation for ${fileName}.`;
        setBatchMessages(prev => ({ ...prev, [fileId]: errorMsg }));
        setBatchProcessingFileId(null); // Re-enable button on error
      });
  };
  const fetchRepoDetails = useCallback(() => {
    if (repoId) {
      setLoading(true); // Consider if you want a full page loading spinner here or something more subtle
      axios.get(`/api/v1/repositories/${repoId}/`, { withCredentials: true })
        .then(response => {
          const repoData = response.data;
          const targetFilePath = "ImageEditor.py"; // Change to your file
          const targetClassName = "ImageOps";    // Change to your class
          const targetMethodName = "Capture"; // Change to your method

          const fileObj = repoData.files.find(f => f.file_path === targetFilePath);
          if (fileObj) {
            const classObj = fileObj.classes.find(c => c.name === targetClassName);
            if (classObj) {
              const methodObj = classObj.methods.find(m => m.name === targetMethodName);
              if (methodObj) {
                console.log(`REPO_DETAIL_PAGE: Target Method Data ('${targetMethodName}'):`,
                  JSON.parse(JSON.stringify(methodObj))
                );
              } else {
                console.warn(`REPO_DETAIL_PAGE: Target method '${targetMethodName}' not found in class '${targetClassName}'.`);
              }
            } else {
              console.warn(`REPO_DETAIL_PAGE: Target class '${targetClassName}' not found in file '${targetFilePath}'.`);
            }
          } else {
            console.warn(`REPO_DETAIL_PAGE: Target file '${targetFilePath}' not found.`);
          }
          setRepo(repoData);

          // If a file was selected, try to update its reference to the new data
          if (selectedFile) {
            const updatedSelectedFile = repoData.files.find(
              (file: CodeFile) => file.id === selectedFile.id
            );
            setSelectedFile(updatedSelectedFile || null); // Update or clear if not found
            // If selectedFile is updated, you might also want to re-fetch its content
            // if its structure_hash changed, but that's a further optimization.
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching repository details:", err);
          setError('Failed to load repository details.');
          setLoading(false);
        });
    }
  }, [repoId, selectedFile]);
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (activeDocGenTaskId) {
      setDocGenTaskProgress(0); // Reset progress for new task
      setPrURL(null); // Clear any old PR URL

      const poll = async () => {
        const finished = await pollTaskStatus(
          activeDocGenTaskId,
          setDocGenTaskMessage,
          setDocGenTaskProgress,
          setActiveDocGenTaskId, // This will set it to null on completion/failure
          (resultData) => { // onSuccess
            console.log("Batch Doc Gen Success Result:", resultData);
            // Potentially update UI further based on resultData
            // e.g., "Successfully documented X symbols in Y files."
            if (resultData && resultData.message) {
              setDocGenTaskMessage(resultData.message);
            } else {
              setDocGenTaskMessage("Batch documentation generation completed successfully.");
            }
            console.log("Batch Doc Gen Succeeded. Re-fetching repository details...");
            fetchRepoDetails();
          },
          (resultData) => { // onFailure
            console.log("Batch Doc Gen Failure Result:", resultData);
            if (resultData && resultData.message) {
              setDocGenTaskMessage(`Failed: ${resultData.message}`);
            } else {
              setDocGenTaskMessage("Batch documentation generation failed.");
            }
          }
        );
        if (finished) {
          clearInterval(intervalId);
        }
      };
      poll(); // Initial immediate poll
      intervalId = setInterval(poll, 5000); // Poll every 5 seconds
    }
    return () => clearInterval(intervalId); // Cleanup on unmount or if taskId changes
  }, [activeDocGenTaskId, fetchRepoDetails]);
  const handleAnalysisChange = useCallback(() => {
    fetchRepoDetails();
  }, [fetchRepoDetails]);
  const handleSaveDoc = async (funcId: number) => { // Made async for await
    const docText = generatedDocs[funcId];
    if (!docText) return;

    setSavingDocId(funcId); // Set saving state

    try {
      await axios.post( // Added await
        `/api/v1/functions/${funcId}/save-docstring/`,
        { documentation_text: docText },
        {
          withCredentials: true,                 // ← send session+csrf cookies
          headers: {
            'X-CSRFToken': getCookie('csrftoken') // ← required for PATCH
          }
        }
      );

      setGeneratedDocs(prev => {
        const newDocs = { ...prev };
        delete newDocs[funcId];
        return newDocs;
      });
      fetchRepoDetails();
    } catch (err) {
      console.error("Error saving documentation:", err);
      alert("Failed to save documentation.");
    } finally {
      setSavingDocId(null); // Clear saving state
    }
  };

  useEffect(() => {
    setLoading(true); // Set loading true only on initial mount
    fetchRepoDetails();
  }, [repoId]);

  const handleFileSelect = (file: CodeFile) => {
    // 1. Immediately update the selected file object.
    setSelectedFile(file);

    // 2. Immediately reset all content-related states to show a loading view.
    //    Using `null` is a clear signal that there is no content yet.
    setFileContent(null);
    setModifiedFileContent(null);
    setContentLoading(true);

    // 3. Fetch the new content.
    axios.get(`/api/v1/files/${file.id}/content/`, { withCredentials: true })
      .then(response => {
        console.log("API Response:", response);
        // Assuming the API returns { "content": "..." }
        const fetchedContent = response.data;

        // 4. Update BOTH the original content and the editor's content state.
        //    This is the crucial step to sync the editor with the new file.
        setFileContent(fetchedContent);
        setModifiedFileContent(fetchedContent);
      })
      .catch(err => {
        console.error("Error fetching file content:", err);
        const errorContent = `// Failed to load content for ${file.file_path}\n// ${err.message}`;
        // Also update both states on error to display the error message in the editor.
        setFileContent(errorContent);
        setModifiedFileContent(errorContent);
      })
      .finally(() => {
        // 5. Always turn off the loading indicator.
        setContentLoading(false);
      });
  };

  const editorLanguage = useMemo(() => {
    if (selectedFile) {
      return getLanguage(selectedFile.file_path); // Use your existing getLanguage helper
    }
    return 'plaintext';
  }, [selectedFile]);
  const handleGenerateDoc = async (funcId: number) => {
    setGeneratingDocId(funcId);
    setGeneratedDocs(prev => ({ ...prev, [funcId]: '' }));

    try {
      const response = await fetch(
        `/api/v1/functions/${funcId}/generate-docstring/`,
        { credentials: 'include' } // Your correct credentials setting
      );
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setGeneratedDocs(prev => ({ ...prev, [funcId]: (prev[funcId] || '') + chunk }));
      }
    } catch (error) {
      console.error("Error generating documentation:", error);
      setGeneratedDocs(prev => ({ ...prev, [funcId]: "// Failed to generate documentation." }));
    } finally {
      setGeneratingDocId(null);
    }
  };
  // --- END OF YOUR CORRECT API CALL LOGIC ---
  const handleCreatePRForFile = (fileId: number, fileName: string) => {
    console.log("DEBUG_FRONTEND: handleCreatePRForFile called for fileId:", fileId, "Current creatingPRFileId:", creatingPRFileId); // Add this

    if (creatingPRFileId !== null) return;

    // 2️⃣ Mark this file as “in flight.”
    setCreatingPRFileId(fileId);

    // 3️⃣ Do the POST exactly once.
    axios.post(
      `/api/v1/files/${fileId}/create-batch-pr/`,
      {},
      {
        withCredentials: true,
        headers: { 'X-CSRFToken': getCookie('csrftoken') },
      }
    )
      .then(({ data }) => {
        setPrMessages(prev => ({
          ...prev,
          [fileId]: `PR creation started (Task ID: ${data.task_id}). Check GitHub for the PR.`
        }));
      })
      .catch(err => {
        const errorMsg = err.response?.data?.error
          || `Failed to start PR creation for ${fileName}.`;
        setPrMessages(prev => ({ ...prev, [fileId]: errorMsg }));
      })
      .finally(() => {
        // 4️⃣ Always clear the in-flight flag when done
        setCreatingPRFileId(null);
      });
  };

  if (loading && !repo) return <p className="p-6 text-center text-foreground">Loading repository...</p>;
  if (error) return <p className="p-6 text-center text-destructive">{error}</p>;
  if (!repo) return <p className="p-6 text-center text-muted-foreground">Repository not found or not yet loaded.</p>;

  return (
    // The main container is now a flex column to hold the header and the tabs
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-hidden">

      {/* ============================================= */}
      {/* Header (FileTreeHeader) - Stays at the top    */}
      {/* ============================================= */}
      {repo && (
        <FileTreePanel
          repoId={repo.id}
          repoFullName={repo.full_name}
          repoStatus={repo.status}
          onSyncStart={fetchRepoDetails} // Assuming you have this handler
        />
      )}

      {/* ============================================= */}
      {/* Tabs for switching between views            */}
      {/* ============================================= */}
      <Tabs defaultValue="files" value={getActiveTab()} className="flex-grow flex flex-col min-h-0">

        {/* --- 2. Tab Triggers (The navigation bar for the tabs) --- */}
        <div className="px-4 border-b border-border flex-shrink-0">
          <TabsList className="bg-transparent p-0">
            <TabsTrigger value="files" asChild>
              <Link to={`/repository/${repoId}`}><LayoutGrid className="mr-2 h-4 w-4" />Browser</Link>
            </TabsTrigger>
            {/* --- NEW TAB TRIGGER --- */}
            <TabsTrigger value="architecture" asChild>
              <Link to={`/repository/${repoId}/architecture`}><Share2 className="mr-2 h-4 w-4" />Architecture</Link>
            </TabsTrigger>
            {/* --- END NEW TAB --- */}
            <TabsTrigger value="activity" asChild>
              <Link to={`/repository/${repoId}/activity`}><History className="mr-2 h-4 w-4" />Activity & Insights</Link>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* --- 3. Tab Content for "File Browser" --- */}
        <TabsContent value="files" className="flex-grow flex flex-row overflow-hidden mt-0">
          {/* Your existing three-panel layout is now wrapped in this TabsContent */}
          {/* It remains a flex row to keep the side-by-side panel structure */}

          {/* ============================================= */}
          {/* Left Panel (File Tree, Batch Actions, Orphans)*/}
          {/* ============================================= */}
          <aside className="w-[300px] md:w-[380px] flex-shrink-0 border-l border-border flex flex-col bg-background min-w-0 min-h-0 overflow-hidden">
            {/* This wrapper ensures the panels inside don't overflow the aside */}
            <div className="flex-grow flex flex-col min-h-0">
              <div className="flex-grow overflow-y-auto min-h-0">
                <FileTreePanel
                  repo={repo}
                  selectedFile={selectedFile}
                  onFileSelect={handleFileSelect}
                  selectedFilesForBatch={selectedFilesForBatch}
                  onSelectedFilesForBatchChange={setSelectedFilesForBatch}
                  onGenerateDocsForFile={handleBatchGenerateDocsForFile}
                  batchProcessingFileId={batchProcessingFileId}
                  batchMessages={batchMessages}
                  onCreatePRForFile={handleCreatePRForFile}
                  creatingPRFileId={creatingPRFileId}
                  prMessages={prMessages}
                  isAnyOperationInProgress={isAnyOperationInProgressForFileTree}
                />
              </div>

              {repo.files.length > 0 && (
                <div className="p-3 md:p-4 border-t border-border bg-background shadow-inner mt-auto flex-shrink-0">
                  <BatchActionsPanel
                    selectedFileCount={selectedFilesForBatch.size}
                    onBatchGenerateDocs={handleBatchGenerateDocsForRepo}
                    activeDocGenTaskId={activeDocGenTaskId}
                    docGenTaskMessage={docGenTaskMessage}
                    docGenTaskProgress={docGenTaskProgress}
                    onBatchCreatePR={handleCreateBatchPRForRepo}
                    activePRCreationTaskId={activePRCreationTaskId}
                    prCreationTaskMessage={prCreationTaskMessage}
                    prCreationTaskProgress={prCreationTaskProgress}
                    isAnyFileSpecificActionInProgress={isAnyFileSpecificActionInProgress}
                  />
                </div>
              )}

              <div className="border-t border-border bg-background shadow-inner overflow-y-auto max-h-[250px]">
                <div className="p-3 md:p-4">
                  <OrphanSymbolsPanel orphanSymbols={orphanSymbolsList as OrphanSymbolDisplayItem[]} />
                </div>
              </div>

            </div>
          </aside>

          {/* ============================================= */}
          {/* Center Panel (Code Viewer)                  */}
          {/* ============================================= */}
          <main className="flex-grow flex flex-col overflow-hidden bg-background min-w-0">
            {/* --- NEW: Header for the editor with a Save button --- */}
            <div className="flex items-center justify-between p-2 border-b border-border bg-card flex-shrink-0">
              <span className="text-sm font-mono text-muted-foreground">
                {selectedFile ? selectedFile.file_path : 'No file selected'}
              </span>
              {hasUnsavedChanges && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-yellow-400">Unsaved Changes</span>
                  <Button size="sm" onClick={handleSaveChanges}>Save</Button>
                </div>
              )}
            </div>
            {/* --- END NEW HEADER --- */}

            {/* --- REPLACE CodeViewerPanel with CodeEditorPanel --- */}
            <div className="flex-grow min-h-0">
              {console.log("Rendering CodeEditorPanel with props:", {
                content: modifiedFileContent,
                isLoading: contentLoading,
                language: editorLanguage,
              })}

              <CodeEditorPanel
                key={selectedFile ? selectedFile.id : 'no-file-selected'}

                // Pass the state that is bound to the editor's changes.
                content={modifiedFileContent}

                isLoading={contentLoading}

                onContentChange={handleContentChange}

                // Pass the correctly derived language.
                language={editorLanguage}
              />
            </div>
          </main>

          {/* ============================================= */}
          {/* Right Panel (Analysis)                      */}
          {/* ============================================= */}
          <aside className="w-[350px] md:w-[400px] flex-shrink-0 h-full border-l border-border flex flex-col bg-background min-w-0">
            <AnalysisPanel
              repoId={repo.id}
              selectedFile={selectedFile}
              generatedDocs={generatedDocs}
              onGenerateDoc={handleGenerateDoc}
              generatingDocId={generatingDocId}
              onSaveDoc={handleSaveDoc}
              savingDocId={savingDocId}
              onAnalysisChange={handleAnalysisChange}
            />
          </aside>
        </TabsContent>

        {/* --- 4. Tab Content for "Activity & Insights" --- */}
        <TabsContent value="activity" className="flex-grow overflow-y-auto mt-0">
          {/* The new ActivityFeed component will live here. */}
          {/* It will manage its own layout (e.g., the two-pane commit graph + details). */}
          {repo && <ActivityFeed repoId={repo.id} />}
        </TabsContent>

      </Tabs>
    </div>
  );
}