import { type SignatureLocation } from '@/types';
export function injectDocstring(
  originalCode: string,
  docstringText: string,
  signatureEndLocation: SignatureLocation,
  bodyIndentation: number
): string {
  const lines = originalCode.split('\n');
  const indent = ' '.repeat(bodyIndentation);

  // Format the new docstring with triple quotes and proper indentation
  const formattedDocstringLines = docstringText.split('\n').map(line => `${indent}${line}`);
  const finalDocstring = `${indent}"""\n${formattedDocstringLines.join('\n')}\n${indent}"""`;

  // The line index is 0-based, but our location data is 1-based
  const signatureLineIndex = signatureEndLocation.line - 1;

  // Splice the docstring into the array of lines
  lines.splice(signatureLineIndex + 1, 0, finalDocstring);

  return lines.join('\n');
}

/**
 * A simple heuristic to determine the indentation of a function body.
 * It finds the first non-empty line after the signature and counts leading spaces.
 */
export function getFunctionBodyIndentation(
  originalCode: string,
  signatureEndLine: number
): number {
    const lines = originalCode.split('\n');
    for (let i = signatureEndLine; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() !== '') {
            return line.length - line.trimStart().length;
        }
    }
    // Default to 4 spaces if no content is found (e.g., just a 'pass' statement)
    return 4;
}