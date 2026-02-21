import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { ocrPdfFromBuffer } from "@/lib/pdf/azure-ocr";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // OCR can be slow for large PDFs
const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const getStorageType = (): "supabase" | "local" => {
  const storageType = process.env.STORAGE_TYPE || "supabase";
  return storageType === "local" ? "local" : "supabase";
};

async function saveFileLocally(buffer: Buffer, filename: string): Promise<string> {
  const uploadsDir = process.env.UPLOADS_DIR || join(process.cwd(), "uploads");
  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true });
  }
  const filePath = join(uploadsDir, filename);
  await writeFile(filePath, buffer);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/api/files/${filename}`;
}

/**
 * POST /api/pdf/upload-and-ocr
 * Accepts a PDF file via multipart form, uploads to storage, runs OCR on the buffer,
 * returns fileUrl + OCR result. Single request — no fetch-back from storage.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `PDF exceeds ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB limit`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${timestamp}-${random}-${sanitizedName}`;

    const storageType = getStorageType();
    let fileUrl: string;

    if (storageType === "local") {
      fileUrl = await saveFileLocally(buffer, filename);
    } else {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json(
          { error: "Server configuration error: Supabase not configured" },
          { status: 500 }
        );
      }

      const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { error } = await supabase.storage
        .from("file-upload")
        .upload(filename, buffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: "application/pdf",
        });

      if (error) {
        logger.error("[PDF_UPLOAD_OCR] Supabase upload failed:", error);
        return NextResponse.json(
          { error: `Failed to upload: ${error.message}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage
        .from("file-upload")
        .getPublicUrl(filename);
      fileUrl = urlData.publicUrl;
    }

    logger.info("[PDF_UPLOAD_OCR] Upload complete, running OCR", {
      filename,
      sizeMB: (buffer.length / (1024 * 1024)).toFixed(2),
    });

    let ocrResult: Awaited<ReturnType<typeof ocrPdfFromBuffer>>;
    let ocrStatus: "complete" | "failed" = "complete";
    let ocrError: string | undefined;

    try {
      ocrResult = await ocrPdfFromBuffer(buffer);
      logger.info("[PDF_UPLOAD_OCR] OCR complete", {
        pageCount: ocrResult.pages.length,
        textContentLength: ocrResult.textContent.length,
      });
    } catch (err) {
      ocrStatus = "failed";
      ocrError = err instanceof Error ? err.message : "OCR failed";
      logger.warn("[PDF_UPLOAD_OCR] OCR failed, returning file without content:", ocrError);
      ocrResult = { pages: [], textContent: "" };
    }

    return NextResponse.json({
      fileUrl,
      filename: file.name,
      fileSize: file.size,
      textContent: ocrResult.textContent,
      ocrPages: ocrResult.pages,
      ocrStatus,
      ...(ocrError && { ocrError }),
    });
  } catch (error: unknown) {
    logger.error("[PDF_UPLOAD_OCR] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Upload and OCR failed",
      },
      { status: 500 }
    );
  }
}
