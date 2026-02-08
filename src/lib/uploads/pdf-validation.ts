/**
 * Client-side PDF validation utilities.
 *
 * Detects password-protected (encrypted) PDFs by reading the raw file bytes
 * and looking for the /Encrypt dictionary entry in the PDF trailer/xref.
 */

const PDF_HEADER = "%PDF-";

/**
 * Check whether a PDF file is password-protected / encrypted.
 *
 * Reads up to the last 100 KB of the file (where the trailer lives) and
 * searches for the `/Encrypt` keyword that the PDF spec requires for any
 * encrypted document.  This is a lightweight heuristic that works for the
 * vast majority of real-world PDFs without pulling in a full parser.
 *
 * @returns `true` if the file appears to be encrypted, `false` otherwise.
 *          Returns `false` for non-PDF files (caller should gate on MIME type).
 */
export async function isPasswordProtectedPdf(file: File): Promise<boolean> {
  // Only check PDF files
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return false;
  }

  try {
    // Read the file bytes — for large files only read the tail where the
    // trailer/xref table lives, plus a small head to confirm it's a PDF.
    const TAIL_SIZE = 100 * 1024; // 100 KB from the end
    const HEAD_SIZE = 1024; // 1 KB from the start

    // Read head to verify PDF header
    const headBlob = file.slice(0, HEAD_SIZE);
    const headText = await headBlob.text();

    if (!headText.startsWith(PDF_HEADER)) {
      // Not a valid PDF — let other validation handle this
      return false;
    }

    // For small files, read the whole thing
    let tailText: string;
    if (file.size <= TAIL_SIZE) {
      tailText = await file.text();
    } else {
      const tailBlob = file.slice(file.size - TAIL_SIZE);
      tailText = await tailBlob.text();
    }

    // The /Encrypt entry in the trailer signals an encrypted PDF.
    // We check for common patterns:
    //   /Encrypt           — standard trailer key
    //   /Encrypt <ref>     — indirect reference
    return /\/Encrypt\s/.test(tailText) || /\/Encrypt$/.test(tailText);
  } catch {
    // If we can't read the file, don't block the upload — let the server
    // handle it.
    return false;
  }
}

/**
 * Filter an array of files, rejecting any password-protected PDFs.
 *
 * @returns An object with `valid` files and `rejected` file names.
 */
export async function filterPasswordProtectedPdfs(
  files: File[]
): Promise<{ valid: File[]; rejected: string[] }> {
  const results = await Promise.all(
    files.map(async (file) => ({
      file,
      isProtected: await isPasswordProtectedPdf(file),
    }))
  );

  const valid: File[] = [];
  const rejected: string[] = [];

  for (const { file, isProtected } of results) {
    if (isProtected) {
      rejected.push(file.name);
    } else {
      valid.push(file);
    }
  }

  return { valid, rejected };
}
