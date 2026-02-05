export function sanitizeMathLatex(input: string): string {
  if (!input) return "";

  let latex = input.trim();

  // Strip any HTML tags that might have leaked into the latex string.
  latex = latex.replace(/<[^>]*>/g, "");

  // Normalize LaTeX wrapper delimiters to raw latex.
  let updated = true;
  while (updated) {
    updated = false;
    const trimmed = latex.trim();

    const parenMatch = trimmed.match(/^\\\(([\s\S]*?)\\\)$/);
    if (parenMatch) {
      latex = parenMatch[1].trim();
      updated = true;
      continue;
    }

    const bracketMatch = trimmed.match(/^\\\[([\s\S]*?)\\\]$/);
    if (bracketMatch) {
      latex = bracketMatch[1].trim();
      updated = true;
      continue;
    }

    if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
      const inner = trimmed.slice(2, -2);
      // Only strip if no other $$ remain inside.
      if (!inner.includes("$$")) {
        latex = inner.trim();
        updated = true;
        continue;
      }
    }

    if (trimmed.startsWith("$") && trimmed.endsWith("$")) {
      const inner = trimmed.slice(1, -1);
      // Only strip if no other $ remain inside.
      if (!inner.includes("$")) {
        latex = inner.trim();
        updated = true;
        continue;
      }
    }
  }

  return latex;
}
