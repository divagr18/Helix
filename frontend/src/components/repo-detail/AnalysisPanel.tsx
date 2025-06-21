// src/components/repo-detail/AnalysisPanel.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FaRobot, FaSave, FaSpinner, FaRulerCombined, FaBrain } from 'react-icons/fa'; // Keep existing icons for now
// We'll import shadcn/ui Button and Lucide icons for internal items later

import { StatusIcon } from '../StatusIcon'; // Adjust path if needed
import { OrphanIndicator } from '../OrphanIndicator'; // Adjust path if needed

// Assuming types are defined in RepoDetailPage or a central types file
// You'll likely want to move these to src/types.ts eventually
interface CodeSymbol {
    id: number;
    name: string;
    start_line: number;
    end_line: number;
    documentation: string | null;
    content_hash: string | null;
    documentation_hash: string | null;
    documentation_status: string | null;
    is_orphan?: boolean;
    loc?: number;
    cyclomatic_complexity?: number;
    // For context when listing orphans:
    filePath?: string;
    className?: string;
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
    symbols: CodeSymbol[]; // Top-level functions
    classes: CodeClass[];
}
// End of assumed types

interface AnalysisPanelProps {
    selectedFile: CodeFile | null;
    generatedDocs: Record<number, string>;
    onGenerateDoc: (symbolId: number) => void;
    generatingDocId: number | null;
    onSaveDoc: (symbolId: number) => void;
    savingDocId: number | null;
    // Add any other necessary props, e.g., if LOC/CC display needs specific handling
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
    selectedFile,
    generatedDocs,
    onGenerateDoc,
    generatingDocId,
    onSaveDoc,
    savingDocId,
}) => {
    // Helper function for rendering the symbol/method item - we'll refine this heavily later
    // For now, it's mostly the JSX you provided
    const renderSymbolItem = (symbol: CodeSymbol, isMethod: boolean = false, className?: string) => {
        const uniqueKey = `${isMethod ? 'method' : 'func'}-${symbol.id}`;

        // This is a direct copy of your existing complex rendering logic for a symbol.
        // We will refactor this into a smaller SymbolListItem.tsx component later.
        return (
            <div key={uniqueKey} style={{ marginBottom: '20px', border: '1px solid #444', padding: '15px', borderRadius: '8px', backgroundColor: '#252526' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ wordBreak: 'break-all', color: '#d4d4d4', fontSize: '1.1em' }}>
                        <Link to={`/symbol/${symbol.id}`} style={{ color: '#9cdcfe', textDecoration: 'none' }}>{symbol.name}</Link>
                        {className && <span style={{ fontSize: '0.8em', color: '#888', marginLeft: '5px' }}>(from class {className})</span>}
                    </strong>
                    <div className="flex items-center gap-2"> {/* Wrapper for icons */}
                        <StatusIcon
                            documentationStatus={symbol.documentation_status}
                            hasDoc={!!symbol.documentation} // Keep these for StatusIcon's potential fallback logic
                            contentHash={symbol.content_hash}
                            docHash={symbol.documentation_hash}
                        />
                        <OrphanIndicator isOrphan={symbol.is_orphan} />
                    </div>
                </div>
                <div style={{ fontSize: '0.8em', color: '#8b949e', marginTop: '0px', marginBottom: '8px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <small style={{ color: '#888' }}>Lines: {symbol.start_line} - {symbol.end_line}</small>
                    {typeof symbol.loc === 'number' && (
                        <span title={`Lines of Code: ${symbol.loc}`} className="flex items-center">
                            <FaRulerCombined style={{ marginRight: '4px', opacity: 0.7 }} />{symbol.loc}
                        </span>
                    )}
                    {typeof symbol.cyclomatic_complexity === 'number' && (
                        <span title={`Cyclomatic Complexity: ${symbol.cyclomatic_complexity}`} className="flex items-center">
                            <FaBrain style={{ marginRight: '4px', opacity: 0.7 }} />{symbol.cyclomatic_complexity}
                        </span>
                    )}
                </div>

                {/* Display existing documentation from DB */}
                {symbol.documentation && !generatedDocs[symbol.id] && (
                    <div style={{
                        marginTop: '12px', whiteSpace: 'pre-wrap',
                        backgroundColor: '#1e1e1e', padding: '10px',
                        borderRadius: '4px', borderLeft: '3px solid #555', // Use var(--border) later
                        fontFamily: 'monospace', fontSize: '0.9em', color: '#ccc', // Use var(--foreground) later
                        maxHeight: '150px', overflowY: 'auto'
                    }}>
                        {symbol.documentation}
                    </div>
                )}

                {/* Generate/Regenerate Button */}
                <button
                    onClick={() => onGenerateDoc(symbol.id)} // Use prop
                    disabled={generatingDocId != null || savingDocId != null}
                    style={{ /* Your existing button styles - to be replaced by shadcn Button */ }}
                >
                    <FaRobot style={{ marginRight: '8px' }} />
                    {generatingDocId === symbol.id ? 'Generating...' : (symbol.documentation ? 'Regenerate' : 'Generate Docstring')}
                </button>

                {/* Display for AI Generated Docstring */}
                {generatedDocs[symbol.id] && (
                    <div style={{ /* Your existing generatedDocs display styles */ }}>
                        <h4 style={{ /* ... */ }}>Generated Docstring:</h4>
                        <div style={{ /* ... */ }}>
                            {/* Your existing split/map logic for generatedDocs */}
                        </div>
                        <button
                            onClick={() => onSaveDoc(symbol.id)} // Use prop
                            disabled={savingDocId != null}
                            style={{ /* Your existing save button styles - to be replaced by shadcn Button */ }}
                        >
                            {savingDocId === symbol.id ? (
                                <FaSpinner className="animate-spin" style={{ marginRight: '8px' }} />
                            ) : (
                                <FaSave style={{ marginRight: '8px' }} />
                            )}
                            {savingDocId === symbol.id ? 'Saving...' : 'Save Suggestion'}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    // Main return for AnalysisPanel
    return (
        // Panel container - Apply Tailwind classes here
        <div className="h-full flex flex-col"> {/* Ensure it can take full height and layout children vertically */}
            <div className="p-4 border-b border-border sticky top-0 bg-card z-10"> {/* Panel Header */}
                <h3 className="text-lg font-semibold text-foreground">
                    Analysis for: {selectedFile ?
                        <span className="font-normal text-muted-foreground ml-1 truncate" title={selectedFile.file_path}>
                            {selectedFile.file_path.split('/').pop()} {/* Show only filename */}
                        </span>
                        : <span className="font-normal text-muted-foreground ml-1">No file selected</span>
                    }
                </h3>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4"> {/* Scrollable content area */}
                {selectedFile ? (
                    (selectedFile.symbols.length > 0 || selectedFile.classes.length > 0) ? (
                        <> {/* Use Fragment */}
                            {/* --- Render Top-Level Functions (Symbols) --- */}
                            {selectedFile.symbols.map(func => renderSymbolItem(func, false))}

                            {/* --- Render Classes and Their Methods --- */}
                            {selectedFile.classes.map(cls => (
                                // We will restyle this "Class" container later with shadcn Card
                                <div key={`class-${cls.id}`} className="p-3 border border-border rounded-md bg-background space-y-3"> {/* Slightly different bg for class group */}
                                    <h4 className="text-md font-semibold text-foreground">Class: {cls.name}</h4>
                                    <div className="space-y-4 pl-4 border-l border-border ml-1"> {/* Indent methods */}
                                        {cls.methods.map(method => renderSymbolItem(method, true, cls.name))}
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : (
                        <p className="text-muted-foreground text-center py-10">No functions or classes found in this file.</p>
                    )
                ) : (
                    <p className="text-muted-foreground text-center py-10">Select a file to see its analysis.</p>
                )}
            </div>
        </div>
    );
};