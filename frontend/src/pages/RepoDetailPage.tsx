import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaFileCode, FaRobot } from 'react-icons/fa';
import { StatusIcon } from '../components/StatusIcon';
import { FaSave, FaSpinner } from 'react-icons/fa'; // Added FaSpinner for loading state
import { getCookie } from '../utils';

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

  const [generatingDocId, setGeneratingDocId] = useState<number | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<Record<number, string>>({});

  // --- YOUR CORRECT API CALL LOGIC ---
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
      <div style={{ width: '300px', borderRight: '1px solid #333', padding: '10px', overflowY: 'auto' }}>
        <h2 style={{ paddingBottom: '10px' }}><Link to="/dashboard" style={{ color: '#d4d4d4', textDecoration: 'none' }}>Dashboard</Link> / {repo.full_name.split('/')[1]}</h2>
        <hr style={{ borderColor: '#333' }} />
        <ul style={{ paddingLeft: 0 }}>
          {repo.files.map(file => (
            <li
              key={file.id}
              onClick={() => handleFileSelect(file)}
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                backgroundColor: selectedFile?.id === file.id ? '#094771' : 'transparent',
                listStyle: 'none',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                marginBottom: '4px'
              }}
            >
              <FaFileCode style={{ marginRight: '8px', flexShrink: 0 }} /> {file.file_path}
            </li>
          ))}
        </ul>
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