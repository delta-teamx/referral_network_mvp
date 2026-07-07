/**
 * Strip HTML tags and dangerous content from user-generated text.
 * Applied before storage — prevents stored XSS if data is ever
 * rendered outside React's JSX escaping (emails, PDFs, exports).
 */

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
const SCRIPT_RE = /javascript\s*:|data\s*:|vbscript\s*:/gi;
// Intentionally matches control characters to strip them from user input.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function sanitizeText(input: string): string {
  return input
    .replace(HTML_TAG_RE, '')
    .replace(SCRIPT_RE, '')
    .replace(CONTROL_CHAR_RE, '')
    .trim();
}

export function sanitizeArray(input: string[]): string[] {
  return input.map(sanitizeText).filter(Boolean);
}
