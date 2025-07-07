// src/pages/SymbolDetailPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

// Shadcn UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner'; // <-- Import toast
import { CodeExplanationSection } from '../components/symbol-detail/CodeExplanationSection'; // <-- NEW IMPORT
import { AiInsightsTab } from '../components/symbol-detail/AIInsightsTab'; // <-- NEW IMPORT

// Lucide Icons
import { Github, Loader2, TriangleAlert, Share2, Network, FileText } from 'lucide-react';

// Your Existing Extracted Components
import { SymbolHeader } from '../components/symbol-detail/SymbolHeader';
import { DocumentationSection } from '../components/symbol-detail/DocumentationSection';
import { SourceCodeViewer } from '../components/symbol-detail/SourceCodeViewer';
import { DependencyListItem } from '../components/symbol-detail/DependancyListItem';

// React Flow
import ReactFlow, { Controls, Background, MiniMap, useNodesState, useEdgesState, type Node, type Edge, type NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import CustomSymbolNode from '../components/CustomSymbolNode';

export interface LinkedSymbol {
    id: number;
    name: string;
    unique_id: string;
}
interface SymbolNodeData {
    label: string;
    type: 'central' | 'caller' | 'callee';
    db_id: number;
    symbol_kind: 'function' | 'method';
    doc_status: string | null;
}
// Utils and Types
import { getCookie } from '../utils';
import { type CodeSymbol as PageSymbolDetail } from '@/types';

type AppNode = Node<SymbolNodeData>;

const nodeTypesConfig: NodeTypes = {
    customSymbolNode: CustomSymbolNode,
};

enum MarkerType {
    ArrowClosed = 'arrowclosed',
}

export function SymbolDetailPage() {
    const { symbolId } = useParams<{ symbolId: string }>();
    const navigate = useNavigate();
    const [symbol, setSymbol] = useState<PageSymbolDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sourceLang, setSourceLang] = useState<string>('plaintext');

    // For DocumentationSection, isEditingDoc is managed internally by DocumentationSection
    // but aiGeneratedDoc and isGeneratingAIDoc are managed here for the footer display
    const [aiGeneratedDoc, setAiGeneratedDoc] = useState<string | null>(null);
    const [isGeneratingAIDoc, setIsGeneratingAIDoc] = useState<boolean>(false);

    const [prStatus, setPrStatus] = useState<{ message: string, pr_url?: string, task_id?: string, error?: string } | null>(null);
    const [isCreatingPR, setIsCreatingPR] = useState(false);

    const [nodes, setNodes, onNodesChange] = useNodesState<AppNode[]>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
    const [flowLoading, setFlowLoading] = useState<boolean>(false);
    const [flowError, setFlowError] = useState<string | null>(null);
    const [initialLoadAttempted, setInitialLoadAttempted] = useState<boolean>(false);
    const [isExplainingCode, setIsExplainingCode] = useState<boolean>(false);
    const [codeExplanation, setCodeExplanation] = useState<string | null>(null);
    const [explanationError, setExplanationError] = useState<string | null>(null);

    const [isSuggestingTests, setIsSuggestingTests] = useState<boolean>(false);
    const [testSuggestion, setTestSuggestion] = useState<string | null>(null);
    const [testSuggestionError, setTestSuggestionError] = useState<string | null>(null);

    const [isSuggestingRefactors, setIsSuggestingRefactors] = useState<boolean>(false);
    const [refactorSuggestion, setRefactorSuggestion] = useState<string | null>(null);
    const [refactorError, setRefactorError] = useState<string | null>(null);

    const handleNavigateBack = () => navigate(-1);

    const getLanguageFromUniqueId = useCallback((uniqueId: string | undefined): string => {
        if (!uniqueId) return 'plaintext';
        const filePathPart = uniqueId.split('::')[0];
        const extension = filePathPart.split('.').pop()?.toLowerCase() || '';
        switch (extension) {
            case 'py': return 'python';
            case 'js': return 'javascript';
            case 'ts': return 'typescript';
            case 'jsx': return 'jsx';
            case 'tsx': return 'tsx';
            default: return 'plaintext';
        }
    }, []);
    const handleSuggestRefactors = useCallback(async () => {
        if (!symbol) return;

        setIsSuggestingRefactors(true);
        setRefactorSuggestion(""); // Clear previous, set to empty for streaming
        setRefactorError(null);
        toast.info("Helix is analyzing code for refactoring opportunities...");

        try {
            const response = await fetch(
                `/api/v1/symbols/${symbol.id}/suggest-refactors/`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' },
                }
            );

            if (!response.ok) throw new Error(await response.text());
            if (!response.body) throw new Error("Response body is null.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let streamedText = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                if (chunk.includes("// Helix encountered an error")) {
                    throw new Error(chunk.replace("// Helix encountered an error:", "").trim());
                }
                streamedText += chunk;
                setRefactorSuggestion(streamedText);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setRefactorError(errorMessage);
            toast.error("Refactor Suggestion Failed", { description: errorMessage });
        } finally {
            setIsSuggestingRefactors(false);
        }
    }, [symbol]);
    const generateAIDocForSymbol = useCallback(async (): Promise<string | null> => {
        if (!symbol) return null;
        setIsGeneratingAIDoc(true);
        setAiGeneratedDoc(""); // Clear previous, set to empty for streaming
        let streamedText = "";
        try {
            const response = await fetch(`/api/v1/functions/${symbol.id}/generate-docstring/`, { credentials: 'include' });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `AI doc generation failed (status: ${response.status})`);
            }
            if (!response.body) throw new Error("Response body is null.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                streamedText += decoder.decode(value, { stream: true });
                setAiGeneratedDoc(streamedText); // Update parent's AI doc state for footer display
            }
            return streamedText.trim(); // Return final doc to DocumentationSection
        } catch (err) {
            console.error("Error generating AI documentation:", err);
            const errorMessage = `// Error: ${err instanceof Error ? err.message : String(err)}`;
            setAiGeneratedDoc(errorMessage); // Show error in footer
            return errorMessage; // Return error message to DocumentationSection
        } finally {
            setIsGeneratingAIDoc(false);
        }
    }, [symbol]);
    const handleExplainCode = useCallback(async () => {
        if (!symbol) return;

        setIsExplainingCode(true);
        setCodeExplanation(""); // Clear previous, set to empty for streaming
        setExplanationError(null);
        toast.info("Helix is analyzing the code...", {
            description: "Your explanation will appear shortly.",
        });

        try {
            const response = await fetch(
                `/api/v1/symbols/${symbol.id}/explain-code/`,
                {
                    method: 'POST', // Use POST as defined in the backend
                    credentials: 'include',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken') || '', // Include CSRF token for POST
                    },
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Helix explanation failed (status: ${response.status})`);
            }
            if (!response.body) throw new Error("Response body is null.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let streamedText = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });

                // Check for our specific error message format from the backend stream
                if (chunk.includes("// Helix encountered an error")) {
                    throw new Error(chunk.replace("// Helix encountered an error:", "").trim());
                }

                streamedText += chunk;
                setCodeExplanation(streamedText);
            }
            return streamedText.trim();
        } catch (err) {
            console.error("Error generating code explanation:", err);
            const errorMessage = err instanceof Error ? err.message : String(err);
            setExplanationError(errorMessage);
            toast.error("Explanation Failed", {
                description: errorMessage,
            });
        } finally {
            setIsExplainingCode(false);
        }
    }, [symbol]);
    const saveDocumentationForSymbol = useCallback(async (docText: string): Promise<boolean> => {
        if (!symbol) return false;
        try {
            const response = await axios.post(
                `/api/v1/functions/${symbol.id}/save-docstring/`,
                { documentation_text: docText },
                { withCredentials: true, headers: { 'X-CSRFToken': getCookie('csrftoken') } }
            );
            // DocumentationSection will call onDocumentationUpdate, which updates the symbol
            // No, saveDocumentationForSymbol should update the symbol directly from its response
            setSymbol(prev => prev ? { ...prev, ...response.data } : null);
            setAiGeneratedDoc(null);
            toast.success("Documentation saved successfully!");// Clear AI suggestion from footer after successful save
            return true;
        } catch (err) {
            console.error("Error saving documentation:", err);
            toast.error("Failed to save documentation", {
                description: err,
            });
            return false;
        }
    }, [symbol]);

    const handleDocumentationUpdate = useCallback((updatedData: Partial<PageSymbolDetail>) => {
        setSymbol(prev => prev ? { ...prev, ...updatedData } : null);
        // If documentation was updated, clear any stale AI suggestions from the footer
        if (updatedData.documentation !== undefined) {
            setAiGeneratedDoc(null);
        }
    }, []);

    const handleCreatePR = useCallback(async () => {
        if (!symbol) return;
        setIsCreatingPR(true);
        setPrStatus({ message: "Initiating PR creation..." });
        try {
            const response = await axios.post(`/api/v1/symbols/${symbol.id}/create-pr/`, {}, {
                withCredentials: true,
                headers: { 'X-CSRFToken': getCookie('csrftoken') }
            });
            setPrStatus({ message: "PR creation task started.", task_id: response.data.task_id });
            toast.info("PR creation task initiated", {
                description: `Task ID: ${response.data.task_id}. You will be notified upon completion.`,
            });
        } catch (err) {
            console.error("Error initiating PR creation:", err);
            setPrStatus({ message: "Failed to initiate PR creation.", error: axios.isAxiosError(err) ? err.response?.data?.error : String(err) });
        } finally {
            setIsCreatingPR(false);
        }
    }, [symbol]);
    const handleSuggestTests = useCallback(async () => {
        if (!symbol) return;

        setIsSuggestingTests(true);
        setTestSuggestion(""); // Clear previous
        setTestSuggestionError(null);
        toast.info("Helix is preparing test cases...");

        try {
            const response = await fetch(
                `/api/v1/symbols/${symbol.id}/suggest-tests/`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'X-CSRFToken': getCookie('csrftoken') || '' },
                }
            );

            if (!response.ok) throw new Error(await response.text());
            if (!response.body) throw new Error("Response body is null.");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let streamedText = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                if (chunk.includes("// Helix encountered an error")) {
                    throw new Error(chunk.replace("// Helix encountered an error:", "").trim());
                }
                streamedText += chunk;
                setTestSuggestion(streamedText);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            setTestSuggestionError(errorMessage);
            toast.error("Test Suggestion Failed", { description: errorMessage });
        } finally {
            setIsSuggestingTests(false);
        }
    }, [symbol]);
    const handleLoadFlowData = useCallback(() => {
        if (!symbol) return;
        setFlowLoading(true);
        setInitialLoadAttempted(true);
        setNodes([]); setEdges([]); setFlowError(null);
        axios.get(`/api/v1/symbols/${symbol.id}/generate-diagram/`, { withCredentials: true })
            .then(response => {
                if (response.data && response.data.nodes && response.data.edges) {
                    const formattedNodes = response.data.nodes.map((node: any) => ({
                        ...node,
                        position: { x: Number(node.position.x), y: Number(node.position.y) },
                    }));
                    setNodes(formattedNodes as AppNode[]);
                    setEdges(response.data.edges as Edge[]);
                } else { setFlowError("Invalid diagram data structure."); }
            })
            .catch(err => {
                setFlowError(axios.isAxiosError(err) ? err.response?.data?.error : "Failed to load diagram.");
            })
            .finally(() => setFlowLoading(false));
    }, [symbol, setNodes, setEdges]);

    const onNodeClick = useCallback((_: React.MouseEvent, node: AppNode) => {
        if (node.data?.db_id) navigate(`/symbol/${node.data.db_id}`);
    }, [navigate]);

    useEffect(() => {
        if (symbolId) {
            setLoading(true); setError(null); setSymbol(null);
            setNodes([]); setEdges([]); setFlowError(null); setInitialLoadAttempted(false);
            setAiGeneratedDoc(null); /* setIsEditingDoc(false); */ setPrStatus(null); // isEditingDoc is internal to DocumentationSection

            axios.get(`/api/v1/symbols/${symbolId}/`, { withCredentials: true })
                .then(response => {
                    const fetchedSymbol: PageSymbolDetail = response.data;
                    setSymbol(fetchedSymbol);
                    setSourceLang(getLanguageFromUniqueId(fetchedSymbol.unique_id));
                })
                .catch(err => {
                    setError(axios.isAxiosError(err) && err.response?.status === 404 ? "Symbol not found." : "Failed to load symbol details.");
                })
                .finally(() => setLoading(false));
        }
    }, [symbolId, getLanguageFromUniqueId]);

    if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <span className="ml-2">Loading Symbol...</span></div>;
    if (error) return <Alert variant="destructive" className="m-8"><TriangleAlert className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
    if (!symbol) return <Alert variant="default" className="m-8"><AlertDescription>Symbol data not available.</AlertDescription></Alert>;

    // Determine if AI suggestion footer should be shown (only if generating and not in edit mode of DocSection)
    // This logic might need refinement if DocumentationSection's internal `isEditing` state needs to be known here.
    // For now, we assume if `aiGeneratedDoc` has content and `isGeneratingAIDoc` is true, it's a streaming suggestion.
    const showAiSuggestionFooter = isGeneratingAIDoc && aiGeneratedDoc;

    return (
        <div className="flex flex-col h-full bg-muted/30 text-foreground overflow-y-auto">
            <div className="p-4 md:p-6 flex-shrink-0 sticky top-0 bg-background/95 backdrop-blur-md z-20 border-b border-border shadow-sm">
                <SymbolHeader symbol={symbol} onNavigateBack={handleNavigateBack} />
            </div>

            <div className="flex-grow p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 auto-rows-min"
                style={{ backgroundColor: '#080808' }}>

                {/* Documentation Card (col-span-1) */}
                <Card
                    className="col-span-1 md:col-span-2 flex flex-col border border-border bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-shadow duration-300 overflow-hidden"
                >
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base md:text-lg flex items-center">
                            <FileText className="mr-2 h-5 w-5 text-primary" /> Documentation
                        </CardTitle>
                        <CardDescription className="text-xs pt-1">
                            Status: {symbol.documentation_status || "Not documented"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <DocumentationSection
                            symbolId={symbol.id}
                            initialDocumentation={symbol.documentation}
                            // initialDocumentationStatus={symbol.documentation_status} // Status displayed in CardHeader
                            onGenerateAIDoc={generateAIDocForSymbol}
                            isGeneratingAIDoc={isGeneratingAIDoc} // Pass parent's generating state
                            onSaveDoc={saveDocumentationForSymbol}
                            onDocumentationUpdate={handleDocumentationUpdate}
                        />
                    </CardContent>
                    {showAiSuggestionFooter && (
                        <CardFooter className="p-3 border-t border-border flex-shrink-0">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">AI Suggestion (Streaming):</p>
                                <ScrollArea className="max-h-32">
                                    <div className="prose prose-xs dark:prose-invert max-w-none whitespace-pre-wrap bg-muted/20 p-2 rounded-md min-h-[40px]">
                                        {aiGeneratedDoc}
                                    </div>
                                </ScrollArea>
                            </div>
                        </CardFooter>
                    )}
                </Card>

                {/* Source Code Card (col-span-1) */}
                <Card
                    className="col-span-1 flex flex-col border border-border bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-shadow duration-300 overflow-hidden"
                >
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base md:text-lg flex items-center">
                            <FileText className="mr-2 h-5 w-5 text-primary" /> Source Code
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow p-0"> {/* Padding removed for SourceCodeViewer to control it */}
                        <SourceCodeViewer
                            sourceCode={symbol.source_code}
                            language={sourceLang}
                        />
                    </CardContent>
                </Card>
                <AiInsightsTab
                    // Explanation props
                    onExplainCode={handleExplainCode}
                    isExplaining={isExplainingCode}
                    explanation={codeExplanation}
                    explanationError={explanationError}

                    // Test Case props
                    onSuggestTests={handleSuggestTests}
                    isSuggestingTests={isSuggestingTests}
                    testSuggestion={testSuggestion}
                    testSuggestionError={testSuggestionError}

                    // Refactor props
                    onSuggestRefactors={handleSuggestRefactors}
                    isSuggestingRefactors={isSuggestingRefactors}
                    refactorSuggestion={refactorSuggestion}
                    refactorError={refactorError}
                />

                {/* Local Architecture Diagram Card (col-span-1) */}
                <Card
                    className="col-span-1 flex flex-col border border-[#161616] bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-shadow duration-300 overflow-hidden"
                >
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base md:text-lg flex items-center">
                            <Network className="mr-2 h-5 w-5 text-primary" /> Local Architecture
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col">
                        <Button onClick={handleLoadFlowData} disabled={flowLoading || !symbol} variant="outline" size="sm" className="mb-4 self-start border-primary/20 hover:bg-primary/10">
                            {flowLoading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Share2 className="mr-2 h-3 w-3" />}
                            {flowLoading ? 'Loading...' : (nodes.length > 0 ? 'Reload Diagram' : 'Load Diagram')}
                        </Button>
                        {flowError && <Alert variant="destructive" className="mb-3 text-xs p-3 border-2"><TriangleAlert className="mr-1 h-3 w-3 inline-block" /><AlertDescription>{flowError}</AlertDescription></Alert>}

                        <div className={`flex-grow border-2 border-border rounded-lg bg-background/50 shadow-inner relative ${nodes.length > 0 && !flowLoading ? 'min-h-[280px]' : 'min-h-[120px] flex items-center justify-center'}`}>
                            {nodes.length > 0 && !flowLoading ? (
                                <ReactFlow
                                    nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                                    onNodeClick={onNodeClick} fitView fitViewOptions={{ padding: 0.1, duration: 300 }}
                                    nodeTypes={nodeTypesConfig}
                                    defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 }, markerEnd: { type: MarkerType.ArrowClosed, width: 15, height: 15, color: 'hsl(var(--primary))' } }}
                                    connectionLineStyle={{ stroke: 'hsl(var(--primary))', strokeWidth: 1.5 }}
                                    proOptions={{ hideAttribution: true }}
                                >
                                    <Controls showInteractive={false} />
                                    <Background variant="dots" gap={12} size={0.5} color="hsl(var(--border))" />
                                </ReactFlow>
                            ) : (
                                !flowLoading && !flowError && (
                                    <p className="text-sm text-muted-foreground p-4 text-center">
                                        {initialLoadAttempted ? "No diagram data or diagram is empty." : "Click 'Load Diagram' to visualize."}
                                    </p>
                                )
                            )}
                            {flowLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Called By (Incoming Dependencies) Card (col-span-1) */}
                <Card
                    className="col-span-1 flex flex-col border border-[#161616] bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 transition-shadow duration-300 overflow-hidden"
                >
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-base md:text-lg font-semibold flex items-center">
                            <Network className="mr-2 h-4 w-4 text-primary" /> Called By ({symbol.incoming_calls.length})
                        </CardTitle>
                        <CardDescription className="text-xs">Dependents of this symbol</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-hidden px-4 pb-4">
                        {symbol.incoming_calls.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center h-full flex items-center justify-center">None</p>
                        ) : (
                            <ScrollArea className="h-52">
                                <ul className="list-none p-0 m-0 space-y-2 pr-2">
                                    {symbol.incoming_calls.map(dep => <DependencyListItem key={`in-${dep.id}`} dependency={dep} />)}
                                </ul>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>

                {/* Calls (Outgoing Dependencies) Card (col-span-1) */}
                <Card
                    className="col-span-1 flex flex-col border border-[#161616] bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 hover:border-[#636363] transition-shadow duration-300 overflow-hidden"
                    style={{ backgroundColor: '#111111' }}
                >
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-base md:text-lg font-semibold flex items-center">
                            <Share2 className="mr-2 h-4 w-4 text-primary" /> Calls ({symbol.outgoing_calls.length})
                        </CardTitle>
                        <CardDescription className="text-xs">Dependencies of this symbol</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-hidden px-4 pb-4">
                        {symbol.outgoing_calls.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center h-full flex items-center justify-center">None</p>
                        ) : (
                            <ScrollArea className="h-52">
                                <ul className="list-none p-0 m-0 space-y-2 pr-2">
                                    {symbol.outgoing_calls.map(dep => <DependencyListItem key={`out-${dep.id}`} dependency={dep} />)}
                                </ul>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>

                {/* PR Actions Card (col-span-1) */}
                {symbol.documentation && symbol.content_hash === symbol.documentation_hash && (
                    <Card
                        className="col-span-1 flex flex-col border border-[#161616] bg-card/95 backdrop-blur-sm shadow-lg hover:shadow-primary/10 hover:border-[#636363] transition-shadow duration-300 overflow-hidden"
                        style={{ backgroundColor: '#111111' }}
                    >
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base md:text-lg flex items-center">
                                <Github className="mr-2 h-5 w-5 text-primary" /> GitHub Actions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow flex flex-col justify-start">
                            <Button onClick={handleCreatePR} disabled={isCreatingPR || (prStatus?.task_id && !prStatus.pr_url && !prStatus.error)} variant="outline" size="sm" className="w-full border-primary/20 hover:bg-primary/10">
                                <Github className="mr-2 h-4 w-4" />
                                {isCreatingPR ? 'Processing...' : (prStatus?.task_id && !prStatus.pr_url && !prStatus.error ? 'PR In Progress...' : 'Create GitHub PR')}
                            </Button>
                            {prStatus && (
                                <Alert className="mt-3 text-xs p-3 border-2" variant={prStatus.error ? "destructive" : "default"}>
                                    {prStatus.error && <TriangleAlert className="h-3 w-3 inline-block mr-1" />}
                                    <AlertDescription>
                                        {prStatus.message}
                                        {prStatus.pr_url && (<a href={prStatus.pr_url} target="_blank" rel="noopener noreferrer" className="ml-1 font-semibold text-primary hover:underline">View PR</a>)}
                                        {prStatus.task_id && !prStatus.pr_url && <span className="block text-muted-foreground mt-1">Task ID: {prStatus.task_id}</span>}
                                        {prStatus.error && <span className="block mt-1">Details: {prStatus.error}</span>}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}