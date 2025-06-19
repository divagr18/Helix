import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaFileCode, FaRobot } from 'react-icons/fa';
import { StatusIcon } from '../components/StatusIcon';
import { FaSave, FaSpinner } from 'react-icons/fa'; // Added FaSpinner for loading state
import { getCookie } from '../utils';
import { FaMagic, FaSync } from 'react-icons/fa'; // FaMagic for generate, FaSync for processing
import { FaGithub } from 'react-icons/fa'; // For PR button

// --- Type Definitions ---
interface CodeSymbol {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
  documentation: string | null;
  content_hash: string | null;
  documentation_hash: string | null;
}

interface CodeClass {
  id: number;
  name: string;
  start_line: number;
  end_line: number;
  structure_hash: string | null;
  methods: CodeSymbol[];
}

interface CodeFile {
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

  const [activePRCreationTaskId, setActivePRCreationTaskId] = useState<string | null>(null);
  const [prCreationTaskMessage, setPRCreationTaskMessage] = useState<string | null>(null);
  const [prCreationTaskProgress, setPRCreationTaskProgress] = useState<number>(0); // Optional progress
  const [prURL, setPrURL] = useState<string | null>(null); // To store the PR URL
  // --- YOUR CORRECT API CALL LOGIC ---
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
      `http://localhost:8000/api/v1/repositories/${repo.id}/create-batch-pr-selected/`,
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
      const response = await axios.get(`http://localhost:8000/api/v1/task-status/${taskId}/`, {
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
  }, [activeDocGenTaskId]); // Re-run if activeDocGenTaskId changes

  // --- useEffect for Polling Batch PR Creation Task ---
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
      `http://localhost:8000/api/v1/repositories/${repo.id}/batch-generate-docs-selected/`,
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
      `http://localhost:8000/api/v1/files/${fileId}/batch-generate-docs/`,
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
        // We don't setBatchProcessingFileId(null) here immediately.
        // The user will need to refresh or we need a status polling mechanism
        // to know when the backend task is truly complete.
        // For now, the button will remain "Processing..." until a page refresh or new interaction.
        // A simple timeout to re-enable the button after a while for UX:
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
  const fetchRepoDetails = () => {
    if (repoId) {
      setLoading(true);
      axios.get(`http://localhost:8000/api/v1/repositories/${repoId}/`, { withCredentials: true })
        .then(response => {
          const repoData = response.data;
          setRepo(repoData);
          if (selectedFile) {
            const updatedSelectedFile = repoData.files.find(
              (file: CodeFile) => file.id === selectedFile.id
            );
            if (updatedSelectedFile) {
              setSelectedFile(updatedSelectedFile);
            }
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching repository details:", err);
          setError('Failed to load repository details.');
          setLoading(false);
        });
    }
  };
  const handleSaveDoc = async (funcId: number) => { // Made async for await
    const docText = generatedDocs[funcId];
    if (!docText) return;

    setSavingDocId(funcId); // Set saving state

    try {
      await axios.patch( // Added await
        `http://localhost:8000/api/v1/functions/${funcId}/save-docstring/`,
        { documentation: docText },
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
    setSelectedFile(file);
    setFileContent('');
    setContentLoading(true);

    axios.get(`http://localhost:8000/api/v1/files/${file.id}/content/`, { withCredentials: true })
      .then(response => {
        setFileContent(response.data);
        setContentLoading(false);
      })
      .catch(err => {
        console.error("Error fetching file content:", err);
        setFileContent(`// Failed to load content for ${file.file_path}`);
        setContentLoading(false);
      });
  };

  const handleGenerateDoc = async (funcId: number) => {
    setGeneratingDocId(funcId);
    setGeneratedDocs(prev => ({ ...prev, [funcId]: '' }));

    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/functions/${funcId}/generate-docstring/`,
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
      `http://localhost:8000/api/v1/files/${fileId}/create-batch-pr/`,
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
  const getLanguage = (filePath: string) => {
    const extension = filePath.split('.').pop() || '';
    if (extension === 'py') return 'python';
    if (extension === 'js') return 'javascript';
    if (extension === 'ts') return 'typescript';
    return 'plaintext';
  };

  if (loading) return <p>Loading repository...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!repo) return <p>Repository not found.</p>;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#1e1e1e', color: '#d4d4d4' }}>
      {/* ============================================= */}
      {/* File Tree Panel                             */}
      {/* ============================================= */}
      <div style={{ width: '350px', /* Increased width for buttons */ borderRight: '1px solid #30363d', padding: '10px', overflowY: 'auto', backgroundColor: '#0d1117' }}>
        <h2 style={{ paddingBottom: '10px', color: '#c9d1d9' }}>
          <Link to="/dashboard" style={{ color: '#58a6ff', textDecoration: 'none' }}>Dashboard</Link> / {repo.full_name.split('/')[1]}
        </h2>
        <hr style={{ borderColor: '#30363d', marginBottom: '10px' }} />

        {/* Select All Checkbox */}
        {repo && repo.files.length > 0 && (
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #30363d', marginBottom: '5px' }}>
            <input
              type="checkbox"
              id="selectAllFilesCheckbox"
              style={{ marginRight: '10px', cursor: 'pointer' }}
              checked={selectAllFiles}
              onChange={(e) => {
                setSelectAllFiles(e.target.checked);
                if (e.target.checked) {
                  setSelectedFilesForBatch(new Set(repo.files.map(f => f.id)));
                } else {
                  setSelectedFilesForBatch(new Set());
                }
              }}
            />
            <label htmlFor="selectAllFilesCheckbox" style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              {selectAllFiles ? 'Deselect All Files' : 'Select All Files'} ({selectedFilesForBatch.size} / {repo.files.length} selected)
            </label>
          </div>
        )}

        <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
          {repo.files.map(file => (
            <li
              key={file.id}
              style={{
                marginBottom: '4px',
                borderRadius: '6px',
                backgroundColor: selectedFile?.id === file.id ? '#1f6feb' : 'transparent', // Highlight selected file
                // Transition for hover effects if you add them
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px' }}>
                {/* Individual File Checkbox */}
                <input
                  type="checkbox"
                  style={{ marginRight: '10px', cursor: 'pointer', flexShrink: 0 }}
                  checked={selectedFilesForBatch.has(file.id)}
                  onChange={() => {
                    const newSelectedFiles = new Set(selectedFilesForBatch);
                    if (newSelectedFiles.has(file.id)) {
                      newSelectedFiles.delete(file.id);
                    } else {
                      newSelectedFiles.add(file.id);
                    }
                    setSelectedFilesForBatch(newSelectedFiles);
                    // Update selectAllFiles state if needed
                    if (newSelectedFiles.size === repo.files.length) {
                      setSelectAllFiles(true);
                    } else {
                      setSelectAllFiles(false);
                    }
                  }}
                  disabled={batchProcessingRepoId !== null || creatingBatchPRRepoId !== null}
                />
                {/* File Icon, Name (clickable for selection) & Action Buttons */}
                <div
                  onClick={() => handleFileSelect(file)}
                  style={{
                    flexGrow: 1, /* Allow file name to take space */
                    cursor: 'pointer',
                    backgroundColor: selectedFile?.id === file.id ? '#1f6feb' : 'transparent',
                    color: selectedFile?.id === file.id ? 'white' : '#c9d1d9',
                    borderRadius: '6px', // Apply to this inner div if needed
                    padding: '4px 8px', // Padding for the clickable file name area
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <FaFileCode style={{ marginRight: '8px', flexShrink: 0, color: selectedFile?.id === file.id ? 'white' : '#8b949e' }} />
                  <span title={file.file_path}>{file.file_path}</span>
                </div>

                {/* Action Buttons Group */}
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: '10px' /* Spacing from file name */ }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent file selection when clicking this button
                      handleBatchGenerateDocsForFile(file.id, file.file_path);
                    }}
                    disabled={batchProcessingFileId !== null} // Disable if ANY batch job is running
                    title={batchProcessingFileId === file.id ? "Processing Docs..." : (batchProcessingFileId !== null ? "Another batch job is running" : `Generate all missing/stale docs for ${file.file_path}`)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.8em',
                      backgroundColor: batchProcessingFileId === file.id ? '#484f58' : '#2ea043',
                      color: 'white',
                      border: '1px solid rgba(240, 246, 252, 0.1)',
                      borderRadius: '6px',
                      cursor: batchProcessingFileId !== null ? 'not-allowed' : 'pointer',
                      opacity: batchProcessingFileId !== null && batchProcessingFileId !== file.id ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: '5px', // Space between buttons
                    }}
                  >
                    {batchProcessingFileId === file.id ?
                      <FaSync className="animate-spin" style={{ marginRight: '4px' }} /> :
                      <FaMagic style={{ marginRight: '4px' }} />
                    }
                    {batchProcessingFileId === file.id ? "Processing..." : "Docs"}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent file selection
                      handleCreatePRForFile(file.id, file.file_path);
                    }}
                    disabled={creatingPRFileId !== null || batchProcessingFileId !== null} // Disable if any PR is being created OR if docs are being generated
                    title={
                      creatingPRFileId === file.id ? "Creating PR..." :
                        (creatingPRFileId !== null ? "Another PR creation is in progress" :
                          (batchProcessingFileId !== null ? "Wait for doc generation to finish" :
                            `Create PR for ${file.file_path} doc updates`))
                    }
                    style={{
                      padding: '4px 8px',
                      fontSize: '0.8em',
                      backgroundColor: creatingPRFileId === file.id ? '#484f58' : '#586069', // GitHub secondary button color
                      color: 'white',
                      border: '1px solid rgba(240, 246, 252, 0.1)',
                      borderRadius: '6px',
                      cursor: (creatingPRFileId !== null || batchProcessingFileId !== null) ? 'not-allowed' : 'pointer',
                      opacity: (creatingPRFileId !== null && creatingPRFileId !== file.id) || (batchProcessingFileId !== null) ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {creatingPRFileId === file.id ?
                      <FaSync className="animate-spin" style={{ marginRight: '4px' }} /> :
                      <FaGithub style={{ marginRight: '4px' }} />
                    }
                    {creatingPRFileId === file.id ? "Creating..." : "PR"}
                  </button>
                </div>
              </div>

              {/* Display batch/PR message for this file */}
              {(batchMessages[file.id] || prMessages[file.id]) && ( // Check both
                <div style={{
                  fontSize: '0.8em',
                  padding: '4px 12px 8px 12px',
                  // Check both for error styling
                  color: (batchMessages[file.id]?.toLowerCase().includes('error') || batchMessages[file.id]?.toLowerCase().includes('failed') ||
                    prMessages[file.id]?.toLowerCase().includes('error') || prMessages[file.id]?.toLowerCase().includes('failed'))
                    ? '#f85149' : '#8b949e',
                  borderTop: '1px dashed #30363d',
                  marginTop: '4px'
                }}>
                  {batchMessages[file.id] || (prMessages && prMessages[file.id])}
                </div>
              )}
            </li>
          ))}
        </ul>
        {repo && repo.files.length > 0 && (
          <div
            style={{
              padding: '15px 12px', // Consistent padding with file items
              borderTop: '1px solid #30363d',
              marginTop: '10px', // Space above this section
              backgroundColor: '#0d1117' // Match panel background
            }}
          >
            <h3 style={{
              marginTop: 0,
              marginBottom: '12px',
              color: '#c9d1d9',
              fontSize: '1.1em'
            }}>
              Batch Actions for Selected Files ({selectedFilesForBatch.size})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleBatchGenerateDocsForRepo} // This handler should use setActiveDocGenTaskId and setDocGenTaskMessage
                disabled={activeDocGenTaskId !== null || activePRCreationTaskId !== null || selectedFilesForBatch.size === 0}
                title={
                  selectedFilesForBatch.size === 0 ? "Select at least one file" :
                    activeDocGenTaskId !== null ? "Documentation generation in progress..." :
                      activePRCreationTaskId !== null ? "PR creation in progress, please wait..." :
                        "Generate missing/stale docstrings for all selected files"
                }
                style={{
                  backgroundColor: '#2ea043', color: 'white', border: '1px solid rgba(240, 246, 252, 0.1)',
                  padding: '10px 15px', borderRadius: '6px',
                  cursor: (activeDocGenTaskId !== null || activePRCreationTaskId !== null || selectedFilesForBatch.size === 0) ? 'not-allowed' : 'pointer',
                  opacity: (activeDocGenTaskId !== null || activePRCreationTaskId !== null || selectedFilesForBatch.size === 0) ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%'
                }}
              >
                {activeDocGenTaskId ? <FaSync className="animate-spin" style={{ marginRight: '8px' }} /> : <FaMagic style={{ marginRight: '8px' }} />}
                {activeDocGenTaskId ? `Generating Docs (${docGenTaskProgress}%)` : 'Generate Docs for Selected'}
              </button>

              {/* Button for Batch PR Creation */}
              <button
                onClick={handleCreateBatchPRForRepo}
                disabled={activePRCreationTaskId !== null || activeDocGenTaskId !== null || selectedFilesForBatch.size === 0}
                title={
                  selectedFilesForBatch.size === 0 ? "Select files with updated docs first" :
                    activePRCreationTaskId !== null ? "Batch PR creation in progress..." :
                      activeDocGenTaskId !== null ? "Wait for documentation generation to complete" :
                        "Create a single Pull Request for selected files with new/updated documentation"
                }
                style={{
                  backgroundColor: '#586069', color: 'white', border: '1px solid rgba(240, 246, 252, 0.1)',
                  padding: '10px 15px', borderRadius: '6px',
                  cursor: (activePRCreationTaskId !== null || activeDocGenTaskId !== null || selectedFilesForBatch.size === 0) ? 'not-allowed' : 'pointer',
                  opacity: (activePRCreationTaskId !== null || activeDocGenTaskId !== null || selectedFilesForBatch.size === 0) ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%'
                }}
              >
                {activePRCreationTaskId ? <FaSync className="animate-spin" style={{ marginRight: '8px' }} /> : <FaGithub style={{ marginRight: '8px' }} />}
                {activePRCreationTaskId ? `Creating PR (${prCreationTaskProgress}%)` : 'Create PR for Selected'}
              </button>
            </div>

            {/* Display global batch messages */}
            {docGenTaskMessage && (
              <p style={{
                fontSize: '0.9em',
                color: typeof docGenTaskMessage === 'string' && (docGenTaskMessage.toLowerCase().includes('error') || docGenTaskMessage.toLowerCase().includes('failed')) ? '#f85149' : '#8b949e',
                marginTop: '12px', padding: '8px', backgroundColor: '#161b22',
                borderRadius: '4px',
                border: `1px solid ${typeof docGenTaskMessage === 'string' && (docGenTaskMessage.toLowerCase().includes('error') || docGenTaskMessage.toLowerCase().includes('failed')) ? '#f85149' : '#30363d'}`
              }}>
                {docGenTaskMessage}
              </p>
            )}

            {/* Display global messages for Batch PR Creation Task */}
            {prCreationTaskMessage && (
              <p style={{
                fontSize: '0.9em',
                color: typeof prCreationTaskMessage === 'string' && (prCreationTaskMessage.toLowerCase().includes('error') || prCreationTaskMessage.toLowerCase().includes('failed')) ? '#f85149' : '#8b949e',
                marginTop: docGenTaskMessage ? '10px' : '12px', // Adjust margin if both messages might show
                padding: '8px', backgroundColor: '#161b22',
                borderRadius: '4px',
                border: `1px solid ${typeof prCreationTaskMessage === 'string' && (prCreationTaskMessage.toLowerCase().includes('error') || prCreationTaskMessage.toLowerCase().includes('failed')) ? '#f85149' : '#30363d'}`
              }}>
                {prCreationTaskMessage} {/* This will render the JSX fragment with the link if set by the polling useEffect */}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ============================================= */}
      {/* Code View Panel                             */}
      {/* ============================================= */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {contentLoading ? (
          <p style={{ padding: '20px' }}>Loading file...</p>
        ) : selectedFile ? (
          <SyntaxHighlighter language={getLanguage(selectedFile.file_path)} style={vscDarkPlus} showLineNumbers customStyle={{ height: '100%', margin: 0 }}>
            {fileContent}
          </SyntaxHighlighter>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <p>Select a file to view its contents.</p>
          </div>
        )}
      </div>

      {/* ============================================= */}
      {/* Analysis Panel                              */}
      {/* ============================================= */}
      <div style={{ width: '350px', borderLeft: '1px solid #333', padding: '10px', overflowY: 'auto' /* Ensure this panel is scrollable if content overflows */ }}>
        <h3>Analysis for {selectedFile ? selectedFile.file_path : '...'}</h3>
        <hr style={{ borderColor: '#333' }} />
        {selectedFile ? (
          (selectedFile.symbols.length > 0 || selectedFile.classes.length > 0) ? (
            <div style={{ paddingLeft: 0 }}>
              {/* --- Render Top-Level Functions (Symbols) --- */}
              {selectedFile.symbols.map(func => (
                <div key={`func-${func.id}`} style={{ marginBottom: '20px', border: '1px solid #444', padding: '15px', borderRadius: '8px', backgroundColor: '#252526' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ wordBreak: 'break-all', color: '#d4d4d4', fontSize: '1.1em' }}>
                      <Link to={`/symbol/${func.id}`} style={{ color: '#9cdcfe', textDecoration: 'none' }}>{func.name}</Link>
                    </strong>
                    <StatusIcon
                      hasDoc={!!func.documentation}
                      contentHash={func.content_hash}
                      docHash={func.documentation_hash}
                    />
                  </div>
                  <small style={{ color: '#888' }}>Lines: {func.start_line} - {func.end_line}</small>

                  {/* Display existing documentation from DB if not currently generating for this func */}
                  {func.documentation && !generatedDocs[func.id] && (
                    <div style={{
                      marginTop: '12px', whiteSpace: 'pre-wrap',
                      backgroundColor: '#1e1e1e', padding: '10px',
                      borderRadius: '4px', borderLeft: '3px solid #555',
                      fontFamily: 'monospace', fontSize: '0.9em', color: '#ccc',
                      maxHeight: '150px', overflowY: 'auto' // Scrollable if long
                    }}>
                      {func.documentation}
                    </div>
                  )}

                  <button
                    onClick={() => handleGenerateDoc(func.id)}
                    disabled={generatingDocId != null || savingDocId != null} // Disable if any AI op is in progress
                    style={{
                      display: 'flex', alignItems: 'center', marginTop: '12px',
                      cursor: 'pointer', width: '100%', justifyContent: 'center',
                      padding: '8px', border: '1px solid #555',
                      backgroundColor: generatingDocId === func.id ? '#094771' : '#333', // Highlight if generating for this
                      color: '#d4d4d4', borderRadius: '4px',
                      opacity: (generatingDocId != null || savingDocId != null) && generatingDocId !== func.id ? 0.5 : 1, // Dim if other op
                    }}
                  >
                    <FaRobot style={{ marginRight: '8px' }} />
                    {generatingDocId === func.id ? 'Generating...' : (func.documentation ? 'Regenerate' : 'Generate Docstring')}
                  </button>

                  {/* --- ENHANCED DISPLAY FOR GENERATED DOCSTRING --- */}
                  {generatedDocs[func.id] && (
                    <div style={{
                      marginTop: '12px',
                      backgroundColor: '#1e1e1e', // Darker background for contrast
                      padding: '15px',
                      borderRadius: '4px',
                      border: '1px solid #094771', // Accent border
                      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                      fontSize: '0.9em',
                      color: '#d4d4d4',
                      lineHeight: '1.6',
                    }}>
                      <h4 style={{ marginTop: 0, marginBottom: '10px', color: '#569cd6', borderBottom: '1px dashed #444', paddingBottom: '8px' }}>
                        AI Generated Suggestion:
                      </h4>
                      <div style={{ whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                        {/* Simple attempt to format common docstring parts */}
                        {generatedDocs[func.id].split('\\n').map((line, index, arr) => {
                          const trimmedLine = line.trim();
                          if (trimmedLine.startsWith('Args:') || trimmedLine.startsWith('Returns:') || trimmedLine.startsWith('Raises:')) {
                            return <strong key={index} style={{ display: 'block', marginTop: '8px', color: '#4ec9b0' }}>{line}</strong>;
                          }
                          if (trimmedLine.startsWith('- ') || trimmedLine.match(/^\s*\w+\s*\(.+\):/)) { // Parameter lines
                            return <div key={index} style={{ marginLeft: '15px', color: '#c586c0' }}>{line}</div>;
                          }
                          // First line (summary) could be bold or slightly larger
                          if (index === 0 && !arr[index + 1]?.trim().startsWith('Args:')) { // Check if it's a single line summary
                            return <p key={index} style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>{line}</p>;
                          }
                          return <span key={index}>{line}{index < arr.length - 1 && <br />}</span>;
                        })}
                      </div>
                      <button
                        onClick={() => handleSaveDoc(func.id)}
                        disabled={savingDocId != null}
                        style={{
                          display: 'flex', alignItems: 'center', marginTop: '15px',
                          cursor: 'pointer', border: '1px solid #3c7a3c',
                          backgroundColor: savingDocId === func.id ? '#2a522a' : '#3c7a3c', // Greenish
                          color: '#fff', borderRadius: '4px', padding: '8px 12px',
                          opacity: savingDocId != null && savingDocId !== func.id ? 0.5 : 1,
                        }}
                      >
                        {savingDocId === func.id ? (
                          <FaSpinner className="animate-spin" style={{ marginRight: '8px' }} />
                        ) : (
                          <FaSave style={{ marginRight: '8px' }} />
                        )}
                        {savingDocId === func.id ? 'Saving...' : 'Save Suggestion'}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* --- Render Classes and Their Methods --- */}
              {selectedFile.classes.map(cls => (
                <div key={`class-${cls.id}`} style={{ marginBottom: '15px', border: '1px solid #555', padding: '10px', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  <strong style={{ fontSize: '1.1em' }}>Class: {cls.name}</strong>
                  <div style={{ paddingLeft: '15px', marginTop: '10px', borderLeft: '2px solid #444' }}>
                    {cls.methods.map(method => (
                      <div key={`method-${method.id}`} style={{ marginBottom: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <strong style={{ wordBreak: 'break-all' }}>
                            <Link to={`/symbol/${method.id}`} style={{ color: '#d4d4d4' }}>{method.name}</Link>
                          </strong>
                          <StatusIcon hasDoc={!!method.documentation} contentHash={method.content_hash} docHash={method.documentation_hash} />
                        </div>
                        <small>Lines: {method.start_line} - {method.end_line}</small>
                        {method.documentation && !generatedDocs[method.id] && (
                          <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap', backgroundColor: '#2a2a2a', padding: '8px', borderRadius: '3px', borderLeft: '3px solid #555', fontFamily: 'monospace', fontSize: '0.9em' }}>
                            {method.documentation}
                          </div>
                        )}
                        <button onClick={() => handleGenerateDoc(method.id)} disabled={generatingDocId !== null} style={{ display: 'flex', alignItems: 'center', marginTop: '10px', cursor: 'pointer', width: '100%', justifyContent: 'center', padding: '8px', border: '1px solid #555', backgroundColor: '#333', color: '#d4d4d4', borderRadius: '4px' }}>
                          <FaRobot style={{ marginRight: '5px' }} />
                          {generatingDocId === method.id ? 'Generating...' : (method.documentation ? 'Regenerate' : 'Generate Docstring')}
                        </button>
                        {generatedDocs[method.id] && (
                          <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap', backgroundColor: '#2a2a2a', padding: '8px', borderRadius: '3px', borderLeft: '3px solid #094771', fontFamily: 'monospace', fontSize: '0.9em' }}>
                            {generatedDocs[method.id]}
                            <button onClick={() => handleSaveDoc(method.id)} style={{ display: 'flex', alignItems: 'center', marginTop: '10px', cursor: 'pointer', border: '1px solid #555', backgroundColor: '#094771', color: '#fff', borderRadius: '4px', padding: '5px 10px' }}>
                              <FaSave style={{ marginRight: '5px' }} /> Save
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No functions or classes found in this file.</p>
          )
        ) : (
          <p>Select a file to see analysis.</p>
        )}
      </div>
    </div>
  );
}