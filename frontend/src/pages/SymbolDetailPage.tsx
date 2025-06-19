import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import axios from 'axios';
import { StatusIcon } from '../components/StatusIcon';
import { FaArrowLeft, FaExternalLinkAlt, FaCodeBranch, FaSave, FaRobot, FaEdit } from 'react-icons/fa'; // Added icons
import { FaGithub } from 'react-icons/fa'; // For PR button
import { getCookie } from '../utils';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import { FaProjectDiagram, FaSpinner, FaExclamationTriangle } from 'react-icons/fa'; // For button and loading/error states
import Mermaid from 'react-mermaid2'; // The Mermaid component
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('python', python);
// --- Type Definitions for the Symbol Detail API response ---
interface LinkedSymbol {
    id: number;
    name: string;
    unique_id: string; // Ensure this matches your LinkedSymbolSerializer
}
const customStyle = {
    ...vscDarkPlus,
    'code[class*="language-"]': {
        ...vscDarkPlus['code[class*="language-"]'],
        background: '#1f1f1f',        // slightly lighter than #1e1e1e
        borderRadius: '8px',
        padding: '1rem',
    },
    'pre[class*="language-"]::-webkit-scrollbar': {
        height: '8px',
    },
    'pre[class*="language-"]::-webkit-scrollbar-thumb': {
        background: '#3c3c3c',
        borderRadius: '4px',
    },
};
interface SymbolDetail {
    id: number;
    unique_id: string;
    name: string;
    start_line: number;
    end_line: number;
    documentation: string | null;
    content_hash: string | null;
    documentation_hash: string | null;
    incoming_calls: LinkedSymbol[];
    outgoing_calls: LinkedSymbol[];
    source_code: string | null; // Add this

    // We'll add file_path and repo_id if we want to link back or show code
    // For now, let's assume the API provides them or we derive them.
    // For simplicity, we'll omit direct code viewing on this page for this step.
}

export function SymbolDetailPage() {
    const { symbolId } = useParams<{ symbolId: string }>();
    const navigate = useNavigate(); // For the back button
    const [sourceLang, setSourceLang] = useState<string>('plaintext'); // New state for language

    const [symbol, setSymbol] = useState<SymbolDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [prStatus, setPrStatus] = useState<{ message: string, pr_url?: string, task_id?: string, error?: string } | null>(null);
    const [isCreatingPR, setIsCreatingPR] = useState(false);
    const [mermaidCode, setMermaidCode] = useState<string | null>(null);
    const [diagramLoading, setDiagramLoading] = useState<boolean>(false);
    const [diagramError, setDiagramError] = useState<string | null>(null);
    const [isEditingDoc, setIsEditingDoc] = useState<boolean>(false);
    const [editedDoc, setEditedDoc] = useState<string>("");

    // State for AI Doc Generation (if you want to separate its loading/display from existing docs)
    const [aiGeneratedDoc, setAiGeneratedDoc] = useState<string | null>(null);
    const [isGeneratingAIDoc, setIsGeneratingAIDoc] = useState<boolean>(false);
    const handleGenerateAIDoc = async () => {
        if (!symbol) return;
        setIsGeneratingAIDoc(true);
        setAiGeneratedDoc(null); // Clear previous AI doc
        setIsEditingDoc(false); // Exit editing mode if it was active
        // Clear editedDoc if you want AI to overwrite any manual edits not yet saved
        // setEditedDoc(""); 

        try {
            // Assuming your API endpoint for single symbol doc gen is still /functions/<id>/generate-docstring/
            // And it streams text/plain
            const response = await fetch(
                `http://localhost:8000/api/v1/functions/${symbol.id}/generate-docstring/`,
                { credentials: 'include' }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Failed to generate AI documentation (status: ${response.status})`);
            }
            if (!response.body) {
                throw new Error("Response body is null.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let streamedText = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                streamedText += decoder.decode(value, { stream: true });
                setAiGeneratedDoc(streamedText); // Update live as it streams
            }
            // Optionally, once streaming is done, put it into editing mode
            setEditedDoc(streamedText.trim()); // Pre-fill editor with AI doc
            setIsEditingDoc(true); // Enter editing mode

        } catch (error) {
            console.error("Error generating AI documentation:", error);
            setAiGeneratedDoc(`// Error generating AI documentation: ${error instanceof Error ? error.message : String(error)}`);
            // Optionally set editedDoc to this error message too if entering editing mode
            // setEditedDoc(`// Error generating AI documentation: ${error instanceof Error ? error.message : String(error)}`);
            // setIsEditingDoc(true);
        } finally {
            setIsGeneratingAIDoc(false);
        }
    };
    const handleSaveEditedDoc = () => {
        if (!symbol) return;

        // Disable button or show loading state here if needed
        // For simplicity, we'll just make the API call.

        axios.post( // Using POST as per our backend SaveDocstringView
            `http://localhost:8000/api/v1/functions/${symbol.id}/save-docstring/`, // Ensure this URL is correct
            { documentation_text: editedDoc }, // Send the edited content
            {
                withCredentials: true,
                headers: { 'X-CSRFToken': getCookie('csrftoken') } // Crucial for POST with SessionAuth
            }
        )
            .then(response => {
                console.log("Documentation saved successfully:", response.data);
                // Update the main symbol state with the data returned from the save operation
                // This ensures documentation_hash and documentation_status are updated in the UI
                setSymbol(prevSymbol => prevSymbol ? { ...prevSymbol, ...response.data } : null);

                setIsEditingDoc(false);
                setAiGeneratedDoc(null); // Clear any AI-generated temp doc
                // editedDoc will be cleared or reset when editing mode is entered next time
                // Or, you could set setEditedDoc(response.data.documentation) if you want to keep it in sync
            })
            .catch(error => {
                console.error("Error saving documentation:", error);
                const errorMsg = error.response?.data?.error || error.message || "Failed to save documentation.";
                alert(`Failed to save documentation: ${errorMsg}`); // Simple alert for now
                // Potentially set an error state to display in the UI
            });
    };
    const getLanguageFromUniqueId = (uniqueId: string | undefined): string => {
        if (!uniqueId) {
            console.log(`detectLanguage: no uniqueId → plaintext`);
            return 'plaintext';
        }

        const filePathPart = uniqueId.split('::')[0];
        const extension = filePathPart.split('.').pop()?.toLowerCase() || '';

        let lang: string;
        switch (extension) {
            case 'py': lang = 'python'; break;
            case 'js': lang = 'javascript'; break;
            case 'ts': lang = 'typescript'; break;
            case 'jsx': lang = 'jsx'; break;
            case 'tsx': lang = 'typescript'; break;
            case 'java': lang = 'clike'; break;
            case 'c': lang = 'clike'; break;
            case 'cpp': lang = 'clike'; break;
            case 'cs': lang = 'clike'; break;
            case 'json': lang = 'json'; break;
            case 'html': lang = 'markup'; break;
            case 'xml': lang = 'markup'; break;
            default: lang = 'plaintext'; break;
        }

        console.log(`detectLanguage: ext="${extension}" → lang="${lang}"`);
        return lang;
    };
    const handleGenerateDiagram = () => {
        if (!symbol) return; // symbol should be your state variable holding the current symbol's details
        setDiagramLoading(true);
        setMermaidCode(null);
        setDiagramError(null);
        const cacheBuster = `_cb=${new Date().getTime()}`;
        const apiUrl = `http://localhost:8000/api/v1/symbols/${symbol.id}/generate-diagram/?${cacheBuster}`;
        axios.get(apiUrl, { withCredentials: true }) // Use the new apiUrl
            .then(response => {
                console.log("Diagram API Response Status:", response.status);
                console.log("Diagram API Response Data (raw):", response.data);
                console.log("Type of response.data:", typeof response.data);

                if (response.data && typeof response.data === 'object') {
                    console.log("Keys in response.data:", Object.keys(response.data));
                    console.log("Value of response.data.mermaid_code:", response.data.mermaid_code);
                    console.log("Type of response.data.mermaid_code:", typeof response.data.mermaid_code);
                }

                if (response.status === 200 && response.data && response.data.mermaid_code) {
                    setMermaidCode(response.data.mermaid_code);
                } else if (response.status === 304) {

                    console.warn("Received 304 Not Modified for diagram, but expected new data. This might indicate server-side caching still active despite cache buster.");
                    // Fallback to error or try to use a previously stored mermaidCode if that's desired.
                    setDiagramError("Diagram data was not refreshed by the server.");
                }
                else {
                    setDiagramError("Received empty or invalid diagram data from server.");
                }
                setDiagramLoading(false);
            })
            .catch(error => {
                console.error("Error generating diagram:", error);
                const errorMsg = error.response?.data?.error || "Failed to generate diagram.";
                // Optionally set mermaidCode to an error diagram string for visual feedback
                setMermaidCode(`graph TD;\n    error_node["${errorMsg.replace(/"/g, "'")}"];\n style error_node fill:#ffcccc,stroke:#cc0000,color:#330000`);
                setDiagramError(errorMsg);
                setDiagramLoading(false);
            });
    };
    const handleCreatePR = () => {
        if (!symbol) return;
        setIsCreatingPR(true);
        setPrStatus({ message: "Initiating PR creation..." });

        axios.post(`http://localhost:8000/api/v1/symbols/${symbol.id}/create-pr/`, {}, {
            withCredentials: true,                 // ← send session+csrf cookies
            headers: {
                'X-CSRFToken': getCookie('csrftoken') // ← required for PATCH
            }
        })
            .then(response => {
                setPrStatus({
                    message: "PR creation in progress. Check back shortly or monitor task status.",
                    task_id: response.data.task_id
                });
                // You might want to implement polling for task status here or use WebSockets
                // For now, we just inform the user.
            })
            .catch(err => {
                console.error("Error initiating PR creation:", err);
                setPrStatus({ message: "Failed to initiate PR creation.", error: err.response?.data?.error || "Unknown error" });
            })
            .finally(() => {
                setIsCreatingPR(false); // Re-enable button if needed, or manage state better
            });
    };

    useEffect(() => {
        if (symbolId) {
            setLoading(true);
            setError(null); // Clear previous errors
            axios.get(`http://localhost:8000/api/v1/symbols/${symbolId}/`, { withCredentials: true })
                .then(response => {
                    const fetchedSymbol: SymbolDetail = response.data;
                    setSymbol(fetchedSymbol);
                    if (fetchedSymbol.unique_id) { // Set language when symbol is fetched
                        setSourceLang(getLanguageFromUniqueId(fetchedSymbol.unique_id));
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error("Error fetching symbol details:", err);
                    if (err.response && err.response.status === 404) {
                        setError("Symbol not found or you do not have permission to view it.");
                    } else {
                        setError("Failed to load symbol details. Please try again.");
                    }
                    setLoading(false);
                });
        }
    }, [symbolId]); // Re-fetch if symbolId changes (user navigates from one symbol to another)

    if (loading) return <p style={{ padding: '20px', color: '#d4d4d4', textAlign: 'center' }}>Loading Symbol Details...</p>;
    if (error) return <p style={{ padding: '20px', color: 'red', textAlign: 'center' }}>{error}</p>;
    if (!symbol) return <p style={{ padding: '20px', color: '#d4d4d4', textAlign: 'center' }}>Symbol data is not available.</p>;

    // Helper to display a list of linked symbols
    const renderDependencyList = (dependencies: LinkedSymbol[], title: string) => (
        <div style={{ backgroundColor: '#252526', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#ccc', borderBottom: '1px solid #444', paddingBottom: '8px' }}>
                {title} ({dependencies.length})
            </h3>
            {dependencies.length === 0 ? (
                <p style={{ color: '#888', fontSize: '0.9em' }}>None</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {dependencies.map(dep => (
                        <li key={dep.id} style={{ marginBottom: '8px' }}>
                            <Link
                                to={`/symbol/${dep.id}`}
                                title={dep.unique_id}
                                style={{
                                    color: '#9cdcfe',
                                    textDecoration: 'none',
                                    display: 'block',
                                    padding: '8px',
                                    backgroundColor: '#333',
                                    borderRadius: '4px',
                                    transition: 'background-color 0.2s ease'
                                }}
                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#444')}
                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#333')}
                            >
                                <FaCodeBranch style={{ marginRight: '8px', color: '#757575' }} />
                                {dep.name}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    return (
        <div style={{ padding: '20px 40px', fontFamily: 'sans-serif', backgroundColor: '#1e1e1e', color: '#d4d4d4', minHeight: '100vh' }}>

            {/* Back Button */}
            <button
                onClick={() => navigate(-1)} // Go back to the previous page
                style={{
                    display: 'inline-flex', alignItems: 'center',
                    marginBottom: '20px', padding: '8px 15px',
                    backgroundColor: '#333', color: '#d4d4d4',
                    border: '1px solid #555', borderRadius: '4px', cursor: 'pointer'
                }}
            >
                <FaArrowLeft style={{ marginRight: '8px' }} /> Back
            </button>

            {/* Header Section */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '15px',
                borderBottom: '1px solid #444', paddingBottom: '15px', marginBottom: '15px'
            }}>
                <h1 style={{ margin: 0, color: '#569cd6', wordBreak: 'break-all' }}>{symbol.name}</h1>
                <StatusIcon
                    hasDoc={!!symbol.documentation}
                    contentHash={symbol.content_hash}
                    docHash={symbol.documentation_hash}
                />
            </div>
            <p style={{ fontSize: '0.9em', color: '#888', marginTop: 0, marginBottom: '25px', fontStyle: 'italic' }}>
                {symbol.unique_id} (Lines: {symbol.start_line} - {symbol.end_line})
            </p>

            {/* Documentation Section */}
            <div style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                    <h2 style={{ color: '#d4d4d4', margin: 0 }}>
                        Description
                    </h2>
                    {/* Buttons appear only if not in editing mode */}
                    {!isEditingDoc && symbol && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => {
                                    // When clicking "Edit", pre-fill with existing doc or last AI generated one
                                    setEditedDoc(aiGeneratedDoc !== null ? aiGeneratedDoc : (symbol.documentation || ""));
                                    setIsEditingDoc(true);
                                    setAiGeneratedDoc(null); // Clear AI temp doc once editing starts
                                }}
                                style={{ /* your button style, e.g., secondary */ padding: '8px 12px', backgroundColor: '#333', border: '1px solid #555' }}
                                title="Edit current documentation"
                            >
                                <FaEdit style={{ marginRight: '5px' }} /> Edit
                            </button>
                            <button
                                onClick={handleGenerateAIDoc}
                                disabled={isGeneratingAIDoc}
                                style={{ /* your button style, e.g., primary */ padding: '8px 12px', backgroundColor: '#238636', border: 'none' }}
                                title="Generate documentation with AI"
                            >
                                {isGeneratingAIDoc ? <FaSpinner className="animate-spin" style={{ marginRight: '5px' }} /> : <FaRobot style={{ marginRight: '5px' }} />}
                                {isGeneratingAIDoc ? 'Generating...' : (symbol.documentation ? 'Regenerate AI Doc' : 'Generate AI Doc')}
                            </button>
                        </div>
                    )}
                </div>

                {isEditingDoc && symbol ? (
                    <div>
                        <textarea
                            value={editedDoc}
                            onChange={(e) => setEditedDoc(e.target.value)}
                            placeholder="Enter documentation here..."
                            style={{
                                width: '100%',
                                minHeight: '200px', // Increased height
                                backgroundColor: '#010409', // Darker editor background
                                color: '#c9d1d9',
                                border: '1px solid #30363d',
                                borderRadius: '6px',
                                padding: '15px',
                                fontFamily: `'Fira Code', 'Source Code Pro', monospace`, // Monospace font
                                fontSize: '0.9em',
                                lineHeight: '1.6'
                            }}
                        />
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleSaveEditedDoc}
                                style={{ /* your primary save button style */ padding: '10px 15px', backgroundColor: '#2ea043', border: 'none' }}
                            >
                                <FaSave style={{ marginRight: '5px' }} /> Save Changes
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditingDoc(false);
                                    setAiGeneratedDoc(null); // Clear AI temp doc on cancel
                                    // setEditedDoc(""); // Optionally clear, or let it persist until next edit
                                }}
                                style={{ /* your secondary cancel button style */ padding: '10px 15px', backgroundColor: '#586069', border: 'none' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    // Displaying Logic: Show AI generated (if any), else existing, else "no docs"
                    <div style={{
                        backgroundColor: '#252526', padding: '20px', borderRadius: '8px',
                        whiteSpace: 'pre-wrap', lineHeight: '1.6', border: '1px solid #333',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        minHeight: '100px' // Ensure some height even if empty
                    }}>
                        {isGeneratingAIDoc && !aiGeneratedDoc && <span style={{ color: '#888' }}>AI is generating documentation... <FaSpinner className="animate-spin" /></span>}
                        {aiGeneratedDoc !== null ? (
                            // If AI doc is being streamed or just finished, show it
                            aiGeneratedDoc || <span style={{ color: '#888' }}>AI is generating...</span>
                        ) : symbol.documentation ? (
                            symbol.documentation
                        ) : (
                            <span style={{ color: '#888' }}>
                                No documentation available. Click "Generate AI Doc" or "Edit" to add.
                            </span>
                        )}
                    </div>
                )}
            </div>
            {symbol.documentation && symbol.content_hash === symbol.documentation_hash && (
                <div style={{ marginTop: '20px' }}>
                    <button
                        onClick={handleCreatePR}
                        disabled={isCreatingPR || (prStatus && !prStatus.error && !prStatus.pr_url)}
                        style={{ /* ... your button styles ... */ display: 'flex', alignItems: 'center', padding: '10px 15px', backgroundColor: '#2c2c2c', border: '1px solid #555' }}
                    >
                        <FaGithub style={{ marginRight: '8px' }} />
                        {isCreatingPR ? 'Processing...' : (prStatus && prStatus.task_id && !prStatus.pr_url ? 'PR In Progress...' : 'Create GitHub PR with this Docstring')}
                    </button>
                    {prStatus && (
                        <div style={{ marginTop: '10px', padding: '10px', backgroundColor: prStatus.error ? '#5c2c2c' : '#2c3e50', borderRadius: '4px' }}>
                            <p>{prStatus.message}</p>
                            {prStatus.pr_url && (
                                <a href={prStatus.pr_url} target="_blank" rel="noopener noreferrer" style={{ color: '#9cdcfe' }}>View Pull Request</a>
                            )}
                            {prStatus.task_id && !prStatus.pr_url && <p><small>Task ID: {prStatus.task_id}</small></p>}
                            {prStatus.error && <p><small>Details: {prStatus.error}</small></p>}
                        </div>
                    )}
                </div>
            )}
            {symbol.source_code && (
                <div style={{ marginTop: '30px', marginBottom: '30px' }}>
                    <h2 style={{ color: '#d4d4d4', borderBottom: '1px solid #444', paddingBottom: '10px', marginBottom: '15px' }}>
                        Source Code
                    </h2>
                    <div style={{
                        backgroundColor: '#1e1e1e', // Match editor background
                        borderRadius: '8px',
                        border: '1px solid #333',
                        overflow: 'hidden' // For rounded corners on highlighter
                    }}>
                        <SyntaxHighlighter
                            language={sourceLang}
                            style={vscDarkPlus}
                            showLineNumbers
                            wrapLongLines
                            lineNumberStyle={{
                                color: '#6a9955',
                                backgroundColor: '#2d2d2d',
                                paddingRight: '10px',
                            }}
                            customStyle={{
                                margin: 0,
                                padding: '1rem',
                                lineHeight: 1.5,
                                background: 'transparent'
                            }}
                            codeTagProps={{
                                style: {
                                    fontFamily: `'Fira Code', 'Source Code Pro', monospace`,
                                    fontSize: '0.95em',
                                    fontVariantLigatures: 'common-ligatures',
                                    WebkitFontSmoothing: 'antialiased'
                                }
                            }}
                        >
                            {symbol.source_code.trimEnd()} {/* Trim trailing newlines for cleaner display */}
                        </SyntaxHighlighter>
                    </div>
                </div>
            )}
            {/* Dependencies Section - Grid Layout */}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ color: '#d4d4d4', borderBottom: '1px solid #444', paddingBottom: '10px', marginBottom: '20px' }}>
                    Call Graph
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                    {renderDependencyList(symbol.outgoing_calls, "Calls (Dependencies)")}
                    {renderDependencyList(symbol.incoming_calls, "Called By (Dependents)")}
                </div>
            </div>
            {/* Architecture Diagram Section */}
            <div style={{ marginTop: '30px', marginBottom: '30px' }}>
                <h2 style={{ color: '#c9d1d9', borderBottom: '1px solid #30363d', paddingBottom: '10px', marginBottom: '15px' }}>
                    Local Architecture
                </h2>
                <button
                    onClick={handleGenerateDiagram}
                    disabled={diagramLoading || !symbol} // Disable if no symbol or already loading
                    style={{
                        backgroundColor: '#238636', color: 'white', border: 'none', padding: '10px 15px',
                        borderRadius: '6px', cursor: 'pointer', marginBottom: '15px', display: 'flex', alignItems: 'center',
                        opacity: (diagramLoading || !symbol) ? 0.7 : 1
                    }}
                >
                    {diagramLoading ?
                        <FaSpinner className="animate-spin" style={{ marginRight: '8px' }} /> :
                        <FaProjectDiagram style={{ marginRight: '8px' }} />
                    }
                    {diagramLoading ? 'Generating...' : (mermaidCode ? 'Regenerate Diagram' : 'Generate Diagram')}
                </button>

                {diagramLoading && !mermaidCode && <p style={{ color: '#8b949e' }}>Loading diagram...</p>}

                {mermaidCode && (
                    <div style={{
                        marginTop: '15px', border: '1px solid #30363d', padding: '20px',
                        backgroundColor: '#0d1117', borderRadius: '6px', // Dark background for the diagram container
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}>
                        <Mermaid chart={mermaidCode} />
                    </div>
                )}
                {diagramError && !diagramLoading && (
                    <p style={{ color: 'red', marginTop: '10px' }}><FaExclamationTriangle style={{ marginRight: '5px' }} /> {diagramError}</p>
                )}
            </div>
            {/* Placeholder for future "View Source" or "Related Files" */}
            {/* 
      <div style={{ marginTop: '30px' }}>
        <h2 style={{ color: '#d4d4d4', borderBottom: '1px solid #444', paddingBottom: '10px', marginBottom: '15px' }}>
          Source Code
        </h2>
        <p style={{color: '#888'}}>Source code display will be implemented here.</p>
      </div> 
      */}
        </div>
    );
}