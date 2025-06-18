import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Added useNavigate
import axios from 'axios';
import { StatusIcon } from '../components/StatusIcon';
import { FaArrowLeft, FaExternalLinkAlt, FaCodeBranch } from 'react-icons/fa'; // Added icons
import { FaGithub } from 'react-icons/fa'; // For PR button
import { getCookie } from '../utils';

// --- Type Definitions for the Symbol Detail API response ---
interface LinkedSymbol {
    id: number;
    name: string;
    unique_id: string; // Ensure this matches your LinkedSymbolSerializer
}

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
    // We'll add file_path and repo_id if we want to link back or show code
    // For now, let's assume the API provides them or we derive them.
    // For simplicity, we'll omit direct code viewing on this page for this step.
}

export function SymbolDetailPage() {
    const { symbolId } = useParams<{ symbolId: string }>();
    const navigate = useNavigate(); // For the back button

    const [symbol, setSymbol] = useState<SymbolDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [prStatus, setPrStatus] = useState<{ message: string, pr_url?: string, task_id?: string, error?: string } | null>(null);
    const [isCreatingPR, setIsCreatingPR] = useState(false);
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
                    setSymbol(response.data);
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
                <h2 style={{ color: '#d4d4d4', borderBottom: '1px solid #444', paddingBottom: '10px', marginBottom: '15px' }}>
                    Description
                </h2>
                <div style={{
                    backgroundColor: '#252526', padding: '20px', borderRadius: '8px',
                    whiteSpace: 'pre-wrap', lineHeight: '1.6', border: '1px solid #333',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                }}>
                    {symbol.documentation || <span style={{ color: '#888' }}>No documentation has been generated for this symbol yet.</span>}
                </div>
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