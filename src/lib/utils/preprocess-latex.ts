/**
 * Preprocesses markdown content to normalize LaTeX delimiters for Streamdown/remark-math.
 *
 * Handles:
 * 1. Protects currency values ($19.99, $5, $1,000) from being parsed as math
 * 2. Converts \(...\) → $...$ and \[...\] → $$...$$ (remark-math doesn't support these)
 *
 * Preserves code blocks (``` and inline `) so their contents are never modified.
 */

// Currency pattern: $ followed by digits, optional commas/decimals — e.g. $5, $19.99, $1,000.50
// Must NOT be preceded by another $ (to avoid matching inside $$...$$)
const CURRENCY_REGEX = /(?<!\$)\$(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\b/g;

export function preprocessLatex(markdown: string): string {
  if (!markdown) return markdown;

  // 1. Protect code blocks and inline code from modification
  const preserved: string[] = [];
  let result = markdown.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    preserved.push(match);
    return `\x00CODE${preserved.length - 1}\x00`;
  });

  // 2. Protect currency values from being parsed as math delimiters
  //    e.g. "$19.99" → placeholder, restored at the end
  const currencies: string[] = [];
  result = result.replace(CURRENCY_REGEX, (match) => {
    currencies.push(match);
    return `\x00CUR${currencies.length - 1}\x00`;
  });

  // 3. Convert \(...\) → $...$ (inline math)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
    return `$${math}$`;
  });

  // 4. Convert \[...\] → $$...$$ (display math)
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
    return `$$${math}$$`;
  });

  // 5. Restore protected currency values
  result = result.replace(/\x00CUR(\d+)\x00/g, (_match, idx) => {
    return currencies[Number(idx)];
  });

  // 6. Restore protected code blocks
  result = result.replace(/\x00CODE(\d+)\x00/g, (_match, idx) => {
    return preserved[Number(idx)];
  });

  return result;
}
