// src/components/repo-detail/CodeViewerPanel.tsx
import React from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'; // Renamed for clarity
// Choose a dark theme that complements your overall design.
// `vscDarkPlus` is good, or explore others like `okaidia`, `oneDark`, `materialDark`.
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FileText, Code, Loader2 } from 'lucide-react'; // Lucide icons

// Languages for SyntaxHighlighter (import only what you need)
// Make sure these are registered globally ONCE, e.g., in your App.tsx or a central config file
// to avoid re-registering them on every CodeViewerPanel render.
// For this component, we assume they are already registered.
// import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
// import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
// import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
// SyntaxHighlighter.registerLanguage('jsx', jsx);
// SyntaxHighlighter.registerLanguage('tsx', tsx);
// SyntaxHighlighter.registerLanguage('python', python);
// etc.

import { type CodeFile } from '@/pages/RepoDetailPage'; // Assuming types are in RepoDetailPage or a types file
// Adjust path if you move types to a central location like src/types.ts

interface CodeViewerPanelProps {
    selectedFile: CodeFile | null;
    fileContent: string;
    isLoading: boolean; // True when file content is being fetched
    language: string;   // Determined by getLanguage in parent
}

// Custom style for SyntaxHighlighter to better match shadcn/ui dark theme
// and ensure it fills height.
const syntaxHighlighterStyle = {
    ...vscDarkPlus, // Start with a base theme
    'pre[class*="language-"]': {
        ...vscDarkPlus['pre[class*="language-"]'],
        backgroundColor: 'var(--card)', // Use card background for the pre block itself
        // or var(--background) if you want it to blend with page, but card is often better for code blocks
        margin: 0,
        padding: '1rem', // Default padding from vscDarkPlus is usually good
        borderRadius: 'var(--radius)', // Match shadcn/ui border radius
        height: '100%', // Crucial for filling the panel
        overflow: 'auto', // Ensure scrollbars within the pre block
    },
    'code[class*="language-"]': {
        ...vscDarkPlus['code[class*="language-"]'],
        backgroundColor: 'transparent !important', // Code block itself should be transparent over pre's bg
        fontFamily: '"Fira Code", "Source Code Pro", Menlo, Monaco, Consolas, "Courier New", monospace', // Common coding font
        fontSize: '0.875rem', // 14px, adjust as needed
        lineHeight: '1.6',
    },
    // Custom scrollbar styling (optional, works in WebKit browsers)
    'pre[class*="language-"]::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
    },
    'pre[class*="language-"]::-webkit-scrollbar-track': {
        background: 'transparent',
    },
    'pre[class*="language-"]::-webkit-scrollbar-thumb': {
        backgroundColor: 'hsl(var(--border))', // Use border color for thumb
        borderRadius: '4px',
    },
    'pre[class*="language-"]::-webkit-scrollbar-thumb:hover': {
        backgroundColor: 'hsl(var(--muted-foreground))', // Slightly lighter on hover
    },
};

export const CodeViewerPanel: React.FC<CodeViewerPanelProps> = ({
    selectedFile,
    fileContent,
    isLoading,
    language,
}) => {
    if (isLoading) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-6 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>Loading file content...</p>
            </div>
        );
    }

    if (!selectedFile) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-6 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-center">Select a file from the tree to view its contents.</p>
            </div>
        );
    }

    // If fileContent is empty but a file is selected, it might mean content is truly empty or still loading
    // (though isLoading should cover the loading case)
    if (selectedFile && !fileContent && !isLoading) {
        return (
            <div className="flex h-full flex-col items-center justify-center p-6 text-muted-foreground">
                <Code className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-center">
                    Content for <span className="font-medium text-foreground">{selectedFile.file_path}</span> is empty or could not be loaded.
                </p>
            </div>
        );
    }

    return (
        // The parent container in RepoDetailPage should manage overflow and height for this panel.
        // This component will try to fill the height given by its parent.
        <div className="h-full w-full overflow-auto bg-card" > {/* Use bg-card or bg-background */}
            <SyntaxHighlighter
                language={language.toLowerCase()} // Ensure language is lowercase for Prism
                style={syntaxHighlighterStyle}
                showLineNumbers
                wrapLines={true} // Or wrapLongLines={true} depending on preference
                lineNumberStyle={{
                    color: 'hsl(var(--muted-foreground))',
                    minWidth: '3.5em', // Ensure enough space for line numbers
                    paddingRight: '1em',
                    borderRight: '1px solid hsl(var(--border))',
                    userSelect: 'none'
                }}
                customStyle={{
                    height: '100%', // Ensure SyntaxHighlighter itself tries to fill height
                    margin: 0, // Remove any default margin from the component
                    fontSize: '0.875rem', // Match code block font size
                }}
                codeTagProps={{
                    style: { // These apply to the inner <code> tag
                        fontFamily: '"Fira Code", "Source Code Pro", Menlo, Monaco, Consolas, "Courier New", monospace',
                        // fontSize is handled by customStyle or the theme's code block.
                    }
                }}
            >
                {fileContent || ''}
            </SyntaxHighlighter>
        </div>
    );
};