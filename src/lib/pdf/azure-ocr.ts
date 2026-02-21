/**
 * Azure Mistral Document AI OCR for PDFs.
 * Splits large PDFs into 30-page batches (30 MB cap), processes in parallel, merges results.
 */

import { PDFDocument } from "pdf-lib";

const MAX_PAGES_PER_BATCH = 30;
const MAX_BATCH_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB
const DEFAULT_MODEL = "mistral-document-ai-2512";

/** Rich OCR page data from Azure Document AI (stored in PdfData.ocrPages). Dimensions omitted. */
export interface OcrPage {
  index: number;
  markdown: string;
  images?: unknown[];
  footer?: string | null;
  header?: string | null;
  hyperlinks?: unknown[];
  tables?: unknown[];
}

export interface OcrResult {
  pages: OcrPage[];
  textContent: string;
}

/** Azure OCR API response schema (pages array from Document AI) */
interface AzureOcrResponsePage {
  index?: number;
  markdown?: string;
  images?: unknown[];
  footer?: string | null;
  header?: string | null;
  hyperlinks?: unknown[];
  tables?: unknown[];
  dimensions?: { dpi?: number; height?: number; width?: number };
}

interface AzureOcrResponse {
  pages?: AzureOcrResponsePage[];
  [key: string]: unknown;
}

/**
 * Call Azure Document AI OCR endpoint with a base64-encoded PDF chunk.
 */
async function ocrChunk(base64Pdf: string): Promise<OcrPage[]> {
  const apiKey = process.env.AZURE_DOCUMENT_AI_API_KEY;
  const endpoint = process.env.AZURE_DOCUMENT_AI_ENDPOINT;
  const model =
    process.env.AZURE_DOCUMENT_AI_MODEL ?? DEFAULT_MODEL;

  if (!apiKey || !endpoint) {
    throw new Error(
      "AZURE_DOCUMENT_AI_API_KEY and AZURE_DOCUMENT_AI_ENDPOINT must be set"
    );
  }

  const documentUrl = `data:application/pdf;base64,${base64Pdf}`;
  const includeImages = process.env.OCR_INCLUDE_IMAGES !== "false";
  const body = {
    model,
    document: {
      type: "document_url",
      document_name: "chunk",
      document_url: documentUrl,
    },
    include_image_base64: includeImages,
    table_format: "markdown",
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Azure OCR failed (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as AzureOcrResponse;
  const rawPages = json.pages ?? [];

  return rawPages.map((p, i) => {
    const page: OcrPage = {
      index: p.index ?? i,
      markdown: p.markdown ?? "",
    };
    if (p.images?.length) page.images = p.images;
    if (p.footer) page.footer = p.footer;
    if (p.header) page.header = p.header;
    if (p.hyperlinks?.length) page.hyperlinks = p.hyperlinks;
    if (p.tables?.length) page.tables = p.tables;
    return page;
  });
}

/**
 * Split a PDF buffer into page chunks. Respects 30 pages and ~30 MB per batch.
 */
function getChunkRanges(
  pageCount: number,
  buffer: Buffer,
  maxPages: number
): number[][] {
  if (pageCount <= maxPages) {
    return [[0, pageCount - 1]];
  }

  const ranges: number[][] = [];
  const avgBytesPerPage = buffer.length / pageCount;
  const maxPagesForSize = Math.max(
    1,
    Math.floor(MAX_BATCH_SIZE_BYTES / avgBytesPerPage)
  );
  const effectiveMaxPages = Math.min(maxPages, maxPagesForSize);

  for (let start = 0; start < pageCount; start += effectiveMaxPages) {
    const end = Math.min(start + effectiveMaxPages, pageCount) - 1;
    ranges.push([start, end]);
  }
  return ranges;
}

/**
 * Extract a page range from a PDF as a new PDF buffer (base64).
 */
async function extractChunkAsBase64(
  sourceDoc: PDFDocument,
  startIndex: number,
  endIndex: number
): Promise<string> {
  const indices: number[] = [];
  for (let i = startIndex; i <= endIndex; i++) indices.push(i);

  const chunkDoc = await PDFDocument.create();
  const copiedPages = await chunkDoc.copyPages(sourceDoc, indices);
  for (const page of copiedPages) chunkDoc.addPage(page);

  const bytes = await chunkDoc.save();
  return Buffer.from(bytes).toString("base64");
}

/**
 * Run OCR on a PDF buffer. Splits into batches if >30 pages or chunk >30 MB.
 */
export async function ocrPdfFromBuffer(
  buffer: Buffer,
  options?: { maxPagesPerBatch?: number }
): Promise<OcrResult> {
  const maxPages = options?.maxPagesPerBatch ?? MAX_PAGES_PER_BATCH;

  const doc = await PDFDocument.load(buffer);
  const pageCount = doc.getPageCount();

  if (pageCount === 0) {
    return { pages: [], textContent: "" };
  }

  const ranges = getChunkRanges(pageCount, buffer, maxPages);

  const chunkPromises = ranges.map(async ([start, end]) => {
    const base64 = await extractChunkAsBase64(doc, start, end);
    const pages = await ocrChunk(base64);
    return { start, end, pages };
  });

  const chunkResults = await Promise.all(chunkPromises);

  const allPages: OcrPage[] = [];
  let globalIndex = 0;
  for (const { pages } of chunkResults) {
    for (const p of pages) {
      allPages.push({
        ...p,
        index: globalIndex,
      });
      globalIndex++;
    }
  }

  const textContent = allPages
    .map((p) => p.markdown)
    .filter(Boolean)
    .join("\n\n");

  return { pages: allPages, textContent };
}
