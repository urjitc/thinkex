/**
 * Preprocesses markdown content to normalize LaTeX delimiters for Streamdown/remark-math.
 *
 * Fixes two issues:
 * 1. Converts \(...\) → $...$ and \[...\] → $$...$$ (remark-math doesn't support these)
 * 2. Collapses internal newlines in $$ blocks so multiline math renders correctly
 *    (workaround for streamdown parse-blocks splitting issue, fixed in unreleased 83f043c)
 *
 * Preserves code blocks (``` and inline `) so their contents are never modified.
 */
export function preprocessLatex(markdown: string): string {
  if (!markdown) return markdown;

  // 1. Protect code blocks and inline code from modification
  const preserved: string[] = [];
  let result = markdown.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    preserved.push(match);
    return `\x00CODE${preserved.length - 1}\x00`;
  });

  // 2. Convert \(...\) → $...$ (inline math)
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_match, math) => {
    return `$${math}$`;
  });

  // 3. Convert \[...\] → $$...$$ (display math)
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_match, math) => {
    return `$$${math}$$`;
  });

  // 4. Collapse internal newlines in $$ blocks (preserve \\ for matrix row breaks)
  //    This fixes multiline display math that gets split by marked's Lexer.
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => {
    const placeholder = "\x01NEWLINE\x01";
    let processed = math.replace(/\\\\/g, placeholder);
    processed = processed.trim();
    processed = processed.replace(/\n/g, " ");
    processed = processed.replace(new RegExp(placeholder, "g"), "\\\\");
    return `$$\n${processed}\n$$`;
  });

  // 5. Restore protected code blocks
  result = result.replace(/\x00CODE(\d+)\x00/g, (_match, idx) => {
    return preserved[Number(idx)];
  });

  return result;
}
