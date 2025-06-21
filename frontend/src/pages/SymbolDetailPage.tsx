import { useState, useEffect, useMemo, useCallback } from 'react';
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
import CustomSymbolNode from '../components/CustomSymbolNode'; // Adjust path
import './SymbolDetailPage.css';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import { FaRulerCombined, FaBrain } from 'react-icons/fa'; // Icons for LOC and Complexity

import { FaProjectDiagram, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import ReactFlow, {
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    type Node, // Type for nodes
    type Edge, // Type for edges
    type OnConnect, // Type for onConnect callback
    type XYPosition, // Type for position
    type NodeTypes, // For custom nodes
} from 'reactflow';
import 'reactflow/dist/style.css';
import { OrphanIndicator } from '../components/OrphanIndicator'; // <<<< IMPORT

// For button and loading/error states
SyntaxHighlighter.registerLanguage('jsx', jsx);
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('python', python);
// --- Type Definitions for the Symbol Detail API response ---
interface LinkedSymbol {
    id: number;
    name: string;
    unique_id: string; // Ensure this matches your LinkedSymbolSerializer
}
interface SymbolNodeData {
    label: string;
    type: 'central' | 'caller' | 'callee'; // For overall styling based on role in this diagram
    db_id: number;                         // Database ID for navigation
    symbol_kind: 'function' | 'method';    // New: To show if it's a function or method
    doc_status: string | null;             // New: To show documentation status icon
}
// React Flow Node type using our custom data
type AppNode = Node<SymbolNodeData>;
const nodeTypesConfig: NodeTypes = { // Use a different variable name to avoid conflict if needed
    customSymbolNode: CustomSymbolNode,
    // Add other custom node types here if you have them
};
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
export enum MarkerType {
    Arrow = 'arrow',
    ArrowClosed = 'arrowclosed',
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
    documentation_status: string | null;
    source_code: string | null;
    is_orphan?: boolean; // Add this
    loc?: number | null;
    cyclomatic_complexity?: number | null;
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
    // const [mermaidCode, setMermaidCode] = useState<string | null>(null); // Removed as per comment
    // const [diagramLoading, setDiagramLoading] = useState<boolean>(false); // Removed as per comment, replaced by flowLoading
    // const [diagramError, setDiagramError] = useState<string | null>(null); // Removed as per comment, replaced by flowError
    const [isEditingDoc, setIsEditingDoc] = useState<boolean>(false);
    const [editedDoc, setEditedDoc] = useState<string>("");
    const [nodes, setNodes, onNodesChange] = useNodesState<AppNode[]>([]); // Use AppNode type
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
    const [flowLoading, setFlowLoading] = useState<boolean>(false);
    const [flowError, setFlowError] = useState<string | null>(null);

    // State for AI Doc Generation
    const [aiGeneratedDoc, setAiGeneratedDoc] = useState<string | null>(null);
    const [isGeneratingAIDoc, setIsGeneratingAIDoc] = useState<boolean>(false);
    const [initialLoadAttempted, setInitialLoadAttempted] = useState<boolean>(false);

    const handleGenerateAIDoc = async () => {
        if (!symbol) return;
        setIsGeneratingAIDoc(true);
        setAiGeneratedDoc(null);
        setIsEditingDoc(false);

        try {
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
                setAiGeneratedDoc(streamedText);
            }
            setEditedDoc(streamedText.trim());
            setIsEditingDoc(true);

        } catch (error) {
            console.error("Error generating AI documentation:", error);
            setAiGeneratedDoc(`// Error generating AI documentation: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGeneratingAIDoc(false);
        }
    };
    const handleSaveEditedDoc = () => {
        if (!symbol) return;

        axios.post(
            `http://localhost:8000/api/v1/functions/${symbol.id}/save-docstring/`,
            { documentation_text: editedDoc },
            {
                withCredentials: true,
                headers: { 'X-CSRFToken': getCookie('csrftoken') }
            }
        )
            .then(response => {
                console.log("Documentation saved successfully:", response.data);
                setSymbol(prevSymbol => prevSymbol ? { ...prevSymbol, ...response.data } : null);
                setIsEditingDoc(false);
                setAiGeneratedDoc(null);
            })
            .catch(error => {
                console.error("Error saving documentation:", error);
                const errorMsg = error.response?.data?.error || error.message || "Failed to save documentation.";
                alert(`Failed to save documentation: ${errorMsg}`);
            });
    };
    // nodeTypesConfig is defined above, using it directly as nodeTypes
    // const nodeTypes: NodeTypes = {
    // customSymbolNode: CustomSymbolNode,
    // };

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
            case 'tsx': lang = 'typescript'; break; // tsx can be highlighted as typescript
            case 'java': lang = 'clike'; break; // Assuming clike for java
            case 'c': lang = 'clike'; break; // Assuming clike for c
            case 'cpp': lang = 'clike'; break; // Assuming clike for cpp
            case 'cs': lang = 'clike'; break; // Assuming clike for cs
            case 'json': lang = 'json'; break;
            case 'html': lang = 'markup'; break;
            case 'xml': lang = 'markup'; break;
            default: lang = 'plaintext'; break;
        }
        console.log(`detectLanguage: ext="${extension}" → lang="${lang}"`);
        return lang;
    };

    const handleLoadFlowData = useCallback(() => {
        if (!symbol) {
            console.warn("handleLoadFlowData called before symbol data is loaded.");
            setFlowError("Symbol details not yet loaded. Please wait and try again.");
            return;
        }
        setFlowLoading(true);
        setInitialLoadAttempted(true);
        setNodes([]);
        setEdges([]);
        setFlowError(null);

        axios.get(`http://localhost:8000/api/v1/symbols/${symbol.id}/generate-diagram/`, { withCredentials: true })
            .then(response => {
                if (response.data && response.data.nodes && response.data.edges) {
                    const formattedNodes = response.data.nodes.map((node: any) => ({
                        ...node,
                        position: {
                            x: Number(node.position.x),
                            y: Number(node.position.y)
                        },
                    }));
                    setNodes(formattedNodes as AppNode[]);
                    setEdges(response.data.edges as Edge[]);
                } else {
                    setFlowError("Received invalid data structure for diagram.");
                }
                setFlowLoading(false);
            })
            .catch(error => {
                console.error("Error fetching React Flow data:", error);
                setFlowError(error.response?.data?.error || "Failed to load diagram data.");
                setFlowLoading(false);
            });
    }, [symbol, setNodes, setEdges, setFlowLoading, setFlowError, setInitialLoadAttempted]); // symbol is a necessary dependency here

    const onNodeClick = useCallback((event: React.MouseEvent, node: AppNode) => {
        console.log('React Flow Node clicked:', node);
        if (node.data && node.data.db_id) {
            navigate(`/symbol/${node.data.db_id}`);
        } else {
            console.warn("Clicked node does not have db_id in its data:", node.data);
        }
    }, [navigate]);

    const handleCreatePR = () => {
        if (!symbol) return;
        setIsCreatingPR(true);
        setPrStatus({ message: "Initiating PR creation..." });

        axios.post(`http://localhost:8000/api/v1/symbols/${symbol.id}/create-pr/`, {}, {
            withCredentials: true,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
            .then(response => {
                setPrStatus({
                    message: "PR creation in progress. Check back shortly or monitor task status.",
                    task_id: response.data.task_id
                });
            })
            .catch(err => {
                console.error("Error initiating PR creation:", err);
                setPrStatus({ message: "Failed to initiate PR creation.", error: err.response?.data?.error || "Unknown error" });
            })
            .finally(() => {
                setIsCreatingPR(false);
            });
    };

    useEffect(() => {
        if (symbolId) {
            setLoading(true);
            setError(null);
            setSymbol(null); // Clear previous symbol data
            setNodes([]); // Clear diagram data when symbol changes
            setEdges([]);
            setFlowError(null);
            setInitialLoadAttempted(false); // Reset diagram load attempt

            axios.get(`http://localhost:8000/api/v1/symbols/${symbolId}/`, { withCredentials: true })
                .then(response => {
                    const fetchedSymbol: SymbolDetail = response.data;
                    setSymbol(fetchedSymbol);
                    if (fetchedSymbol.unique_id) {
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
    }, [symbolId, setNodes, setEdges]); // Added setNodes and setEdges to dependency array for clarity, though not strictly necessary if handled by clearing states

    if (loading) return <p style={{ padding: '20px', color: '#d4d4d4', textAlign: 'center' }}>Loading Symbol Details...</p>;
    if (error) return <p style={{ padding: '20px', color: 'red', textAlign: 'center' }}>{error}</p>;
    if (!symbol) return <p style={{ padding: '20px', color: '#d4d4d4', textAlign: 'center' }}>Symbol data is not available.</p>;

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

            <button
                onClick={() => navigate(-1)}
                style={{
                    display: 'inline-flex', alignItems: 'center',
                    marginBottom: '20px', padding: '8px 15px',
                    backgroundColor: '#333', color: '#d4d4d4',
                    border: '1px solid #555', borderRadius: '4px', cursor: 'pointer'
                }}
            >
                <FaArrowLeft style={{ marginRight: '8px' }} /> Back
            </button>

            <div style={{
                display: 'flex', alignItems: 'center', gap: '15px',
                borderBottom: '1px solid #444', paddingBottom: '15px', marginBottom: '15px'
            }}>
                <h1 style={{ margin: 0, color: '#569cd6', wordBreak: 'break-all' }}>{symbol.name}</h1>
                <StatusIcon
                    documentationStatus={symbol.documentation_status}
                    hasDoc={!!symbol.documentation}
                    contentHash={symbol.content_hash}
                    docHash={symbol.documentation_hash}
                />
                <OrphanIndicator isOrphan={symbol.is_orphan} />
            </div>
            <div style={{
                fontSize: '0.9em', color: '#8b949e', marginTop: 0,
                marginBottom: '25px', fontStyle: 'italic',
                display: 'flex', flexWrap: 'wrap', gap: '15px' // For layout
            }}>
                <span>{symbol.unique_id}</span>
                <span>(Lines: {symbol.start_line} - {symbol.end_line})</span>
                {/* Display LOC if available */}
                {typeof symbol.loc === 'number' && (
                    <span title="Lines of Code (non-empty, non-comment)">
                        <FaRulerCombined style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                        LOC: {symbol.loc}
                    </span>
                )}
                {/* Display Cyclomatic Complexity if available */}
                {typeof symbol.cyclomatic_complexity === 'number' && (
                    <span title="Cyclomatic Complexity">
                        <FaBrain style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                        CC: {symbol.cyclomatic_complexity}
                    </span>
                )}
            </div>
            <p style={{ fontSize: '0.9em', color: '#888', marginTop: 0, marginBottom: '25px', fontStyle: 'italic' }}>
                {symbol.unique_id} (Lines: {symbol.start_line} - {symbol.end_line})
            </p>

            <div style={{ marginBottom: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
                    <h2 style={{ color: '#d4d4d4', margin: 0 }}>
                        Description
                    </h2>
                    {!isEditingDoc && ( // Removed symbol check as it's guaranteed by this point
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => {
                                    setEditedDoc(aiGeneratedDoc !== null ? aiGeneratedDoc : (symbol.documentation || ""));
                                    setIsEditingDoc(true);
                                    setAiGeneratedDoc(null);
                                }}
                                style={{ padding: '8px 12px', backgroundColor: '#333', border: '1px solid #555', color: '#d4d4d4', cursor: 'pointer', borderRadius: '4px' }}
                                title="Edit current documentation"
                            >
                                <FaEdit style={{ marginRight: '5px' }} /> Edit
                            </button>
                            <button
                                onClick={handleGenerateAIDoc}
                                disabled={isGeneratingAIDoc}
                                style={{ padding: '8px 12px', backgroundColor: '#238636', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px' }}
                                title="Generate documentation with AI"
                            >
                                {isGeneratingAIDoc ? <FaSpinner className="animate-spin" style={{ marginRight: '5px' }} /> : <FaRobot style={{ marginRight: '5px' }} />}
                                {isGeneratingAIDoc ? 'Generating...' : (symbol.documentation ? 'Regenerate AI Doc' : 'Generate AI Doc')}
                            </button>
                        </div>
                    )}
                </div>

                {isEditingDoc ? ( // Removed symbol check as it's guaranteed
                    <div>
                        <textarea
                            value={editedDoc}
                            onChange={(e) => setEditedDoc(e.target.value)}
                            placeholder="Enter documentation here..."
                            style={{
                                width: '100%',
                                minHeight: '200px',
                                backgroundColor: '#010409',
                                color: '#c9d1d9',
                                border: '1px solid #30363d',
                                borderRadius: '6px',
                                padding: '15px',
                                fontFamily: `'Fira Code', 'Source Code Pro', monospace`,
                                fontSize: '0.9em',
                                lineHeight: '1.6'
                            }}
                        />
                        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={handleSaveEditedDoc}
                                style={{ padding: '10px 15px', backgroundColor: '#2ea043', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px' }}
                            >
                                <FaSave style={{ marginRight: '5px' }} /> Save Changes
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditingDoc(false);
                                    setAiGeneratedDoc(null);
                                }}
                                style={{ padding: '10px 15px', backgroundColor: '#586069', border: 'none', color: 'white', cursor: 'pointer', borderRadius: '4px' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{
                        backgroundColor: '#252526', padding: '20px', borderRadius: '8px',
                        whiteSpace: 'pre-wrap', lineHeight: '1.6', border: '1px solid #333',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                        minHeight: '100px'
                    }}>
                        {isGeneratingAIDoc && !aiGeneratedDoc && <span style={{ color: '#888' }}>AI is generating documentation... <FaSpinner className="animate-spin" /></span>}
                        {aiGeneratedDoc !== null ? (
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
                        style={{ display: 'flex', alignItems: 'center', padding: '10px 15px', backgroundColor: '#2c2c2c', border: '1px solid #555', color: '#d4d4d4', cursor: 'pointer', borderRadius: '4px' }}
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
                        backgroundColor: '#1e1e1e',
                        borderRadius: '8px',
                        border: '1px solid #333',
                        overflow: 'hidden'
                    }}>
                        <SyntaxHighlighter
                            language={sourceLang}
                            style={vscDarkPlus} // Using the imported vscDarkPlus directly
                            showLineNumbers
                            wrapLongLines
                            lineNumberStyle={{
                                color: '#6a9955', // Example color, adjust as needed
                                backgroundColor: '#2d2d2d', // Example background, adjust
                                paddingRight: '10px',
                                userSelect: 'none' // Prevent selection of line numbers
                            }}
                            customStyle={{ // customStyle on SyntaxHighlighter itself
                                margin: 0,
                                padding: '1rem', // Ensure padding is applied
                                lineHeight: 1.5,
                                background: 'transparent' // Make it transparent if parent has bg
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
                            {symbol.source_code.trimEnd()}
                        </SyntaxHighlighter>
                    </div>
                </div>
            )}
            <div style={{ marginBottom: '30px' }}>
                <h2 style={{ color: '#d4d4d4', borderBottom: '1px solid #444', paddingBottom: '10px', marginBottom: '20px' }}>
                    Call Graph
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                    {renderDependencyList(symbol.outgoing_calls, "Calls (Dependencies)")}
                    {renderDependencyList(symbol.incoming_calls, "Called By (Dependents)")}
                </div>
            </div>
            <div style={{ marginTop: '30px', marginBottom: '30px' }}>
                <h2 style={{ color: '#c9d1d9', borderBottom: '1px solid #30363d', paddingBottom: '10px', marginBottom: '15px' }}>
                    Local Architecture
                </h2>
                <button
                    onClick={handleLoadFlowData}
                    disabled={flowLoading || !symbol}
                    style={{
                        backgroundColor: '#238636', color: 'white', border: 'none', padding: '10px 15px',
                        borderRadius: '6px', cursor: 'pointer', marginBottom: '15px', display: 'flex', alignItems: 'center',
                        opacity: (flowLoading || !symbol) ? 0.7 : 1
                    }}
                >
                    {flowLoading ? <FaSpinner className="animate-spin" style={{ marginRight: '5px' }} /> : <FaProjectDiagram style={{ marginRight: '5px' }} />}
                    {flowLoading ? 'Loading Diagram...' : (nodes.length > 0 ? 'Reload Diagram' : 'Load Diagram')}
                </button>

                {flowError && <p style={{ color: 'red' }}><FaExclamationTriangle style={{ marginRight: '5px' }} /> {flowError}</p>}

                {nodes.length > 0 && !flowLoading && (
                    <div style={{ height: '500px', border: '1px solid #30363d', borderRadius: '8px', marginTop: '15px', backgroundColor: '#0d1117' }}>
                        <ReactFlow
                            nodes={nodes}
                            onlyRenderVisibleElements={true}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onNodeClick={onNodeClick}
                            fitView
                            fitViewOptions={{ padding: 0.2, duration: 800 }}
                            nodeTypes={nodeTypesConfig}
                            defaultEdgeOptions={{
                                type: 'smoothstep', // Bezier ('default'), 'smoothstep', 'step', or 'straight'
                                animated: true,    // Makes edges "flow"
                                style: {
                                    stroke: '#6a737d', // A medium gray, good for dark themes
                                    strokeWidth: 1.5,
                                },
                                markerEnd: { // Example: Add arrowheads
                                    type: MarkerType.ArrowClosed,
                                    width: 20,
                                    height: 20,
                                    color: '#6a737d',
                                },
                            }}
                            connectionLineStyle={{ stroke: '#6a737d', strokeWidth: 1.5 }} // Style of line while dragging new edge
                            // --- END EDGE CUSTOMIZATION ---

                            proOptions={{ hideAttribution: true }}
                        >
                            <Controls />
                            <MiniMap
                                nodeColor={(node: AppNode) => { // Ensure AppNode type here
                                    // Match colors with CustomSymbolNode for consistency in minimap
                                    if (node.data.type === 'central') return '#1f6feb';
                                    if (node.data.type === 'caller') return '#238636';
                                    if (node.data.type === 'callee') return '#8B1A1A';
                                    return '#555';
                                }}
                                nodeStrokeWidth={3}
                                pannable
                                zoomable
                                style={{ backgroundColor: '#0d1117', border: '3px solid #30363d' }}
                            />
                            <Background variant="dots" gap={16} size={0.6} color="#2d333b" />
                        </ReactFlow>
                    </div>
                )}
                {!initialLoadAttempted && nodes.length === 0 && !flowLoading && !flowError && (
                    <p style={{ color: '#888' }}>Click "Load Diagram" to visualize the local architecture.</p>
                )}
                {initialLoadAttempted && nodes.length === 0 && !flowLoading && !flowError && (
                    <p style={{ color: '#888' }}>No diagram data found or diagram is empty.</p>
                )}
            </div>
        </div>
    );
}