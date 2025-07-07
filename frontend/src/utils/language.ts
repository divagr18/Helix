// src/utils/language.ts

/**
 * A map of file extensions to their corresponding Monaco Editor language identifiers.
 * This can be expanded over time to support more languages.
 * You can find a list of built-in languages here:
 * https://github.com/microsoft/monaco-editor/tree/main/src/basic-languages
 */
const extensionToLanguageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    pyw: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    sh: 'shell',
    sql: 'sql',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    rb: 'ruby',
    php: 'php',
    rs: 'rust',
    dockerfile: 'dockerfile',
};

/**
 * Determines the Monaco Editor language identifier from a file path.
 * @param filePath The full path of the file (e.g., 'src/components/Button.tsx').
 * @returns The language identifier string (e.g., 'typescript') or 'plaintext' if not found.
 */
export function getLanguage(filePath: string): string {
    // Get the part of the string after the last dot.
    const extension = filePath.split('.').pop()?.toLowerCase();

    if (extension && extensionToLanguageMap[extension]) {
        return extensionToLanguageMap[extension];
    }

    // Handle files with no extension or an unrecognized one.
    return 'plaintext';
}