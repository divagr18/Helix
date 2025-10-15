export function getCookie(name: string) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
}

/**
 * Simple utility to update a docstring in code content.
 * This is a simplified implementation that works for most cases.
 * For a more robust solution, you'd want to use a proper AST parser.
 */
export function updateDocstringInAst(
    content: string,
    symbolName: string,
    newDocstring: string,
    className?: string
): string {
    const lines = content.split('\n');
    const symbolPattern = className
        ? new RegExp(`^\\s*(def\\s+${symbolName}\\s*\\()`) // Method in class
        : new RegExp(`^\\s*(def\\s+${symbolName}\\s*\\(|class\\s+${symbolName}\\s*[\\(:])`); // Function or class

    let symbolIndex = -1;

    // Find the line with the symbol definition
    for (let i = 0; i < lines.length; i++) {
        if (symbolPattern.test(lines[i])) {
            symbolIndex = i;
            break;
        }
    }

    if (symbolIndex === -1) {
        console.warn(`Symbol ${symbolName} not found in content`);
        return content; // Return original content if symbol not found
    }

    // Look for existing docstring after the symbol definition
    let docstringStart = -1;
    let docstringEnd = -1;

    // Check lines after the symbol definition for a docstring
    for (let i = symbolIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines and lines with just ':'
        if (!line || line === ':') continue;

        // Check if this line starts a docstring
        if (line.startsWith('"""') || line.startsWith("'''")) {
            docstringStart = i;

            // Check if it's a single-line docstring
            const quote = line.startsWith('"""') ? '"""' : "'''";
            const afterQuote = line.substring(3);
            if (afterQuote.endsWith(quote) && afterQuote.length > 3) {
                // Single-line docstring
                docstringEnd = i;
            } else {
                // Multi-line docstring, find the end
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].trim().endsWith(quote)) {
                        docstringEnd = j;
                        break;
                    }
                }
            }
            break;
        } else {
            // If we hit non-empty, non-docstring code, there's no existing docstring
            break;
        }
    }

    // Format the new docstring
    const indentation = lines[symbolIndex].match(/^(\s*)/)?.[1] || '';
    const docstringIndentation = indentation + '    '; // Add 4 spaces for docstring
    const formattedDocstring = `${docstringIndentation}"""${newDocstring}"""`;

    // Replace or insert the docstring
    const newLines = [...lines];

    if (docstringStart !== -1 && docstringEnd !== -1) {
        // Replace existing docstring
        newLines.splice(docstringStart, docstringEnd - docstringStart + 1, formattedDocstring);
    } else {
        // Insert new docstring after the symbol definition
        // Find the right place to insert (after the function/class line and any decorators)
        let insertIndex = symbolIndex + 1;

        // Skip the function signature if it spans multiple lines
        while (insertIndex < lines.length && !lines[insertIndex - 1].includes(':')) {
            insertIndex++;
        }

        newLines.splice(insertIndex, 0, formattedDocstring);
    }

    return newLines.join('\n');
}