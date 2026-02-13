"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { filterPasswordProtectedPdfs } from "@/lib/uploads/pdf-validation";
import { uploadFileDirect } from "@/lib/uploads/client-upload";

const MAX_TOTAL_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_LINKS = 5;

function isYouTubeUrl(url: string): boolean {
  return /youtube\.com\/watch|youtu\.be\//.test(url);
}

export type FileUploadResult = {
  url: string;
  mediaType: string;
  filename?: string;
  fileSize?: number;
};

export type FileItem = {
  id: string;
  file: File;
  status: "uploading" | "ready" | "error";
  result?: FileUploadResult;
  error?: string;
};

interface HomeAttachmentsContextValue {
  fileItems: FileItem[];
  files: File[];
  links: string[];
  addFiles: (newFiles: File[]) => Promise<void>;
  removeFile: (index: number) => void;
  addLink: (url: string) => void;
  removeLink: (index: number) => void;
  clearAll: () => void;
  totalFileSize: number;
  hasYouTubeLink: boolean;
  canAddMoreLinks: boolean;
  canAddYouTube: boolean;
  hasUploading: boolean;
  /** Waits for all in-flight uploads to complete. Resolves when done. */
  awaitAllUploads: () => Promise<void>;
}

const HomeAttachmentsContext = createContext<HomeAttachmentsContextValue | null>(
  null
);

export function HomeAttachmentsProvider({ children }: { children: ReactNode }) {
  const [fileItems, setFileItems] = useState<FileItem[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const uploadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());

  const files = useMemo(() => fileItems.map((i) => i.file), [fileItems]);
  const totalFileSize = useMemo(
    () => fileItems.reduce((sum, i) => sum + i.file.size, 0),
    [fileItems]
  );

  const hasYouTubeLink = useMemo(
    () => links.some(isYouTubeUrl),
    [links]
  );

  const canAddMoreLinks = links.length < MAX_LINKS;
  const canAddYouTube = !hasYouTubeLink;
  const hasUploading = fileItems.some((i) => i.status === "uploading");

  const addFiles = useCallback(async (newFiles: File[]) => {
    if (newFiles.length === 0) return;

    const currentSize = fileItems.reduce((sum, i) => sum + i.file.size, 0);
    const newSize = newFiles.reduce((sum, f) => sum + f.size, 0);
    const total = currentSize + newSize;

    if (total > MAX_TOTAL_FILE_BYTES) {
      toast.error(
        `Total file size exceeds ${MAX_TOTAL_FILE_BYTES / (1024 * 1024)}MB limit`
      );
      return;
    }

    const pdfFiles = newFiles.filter(
      (f) =>
        f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );
    const nonPdfFiles = newFiles.filter(
      (f) =>
        f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")
    );

    const { valid: validPdfs, rejected: protectedNames } =
      await filterPasswordProtectedPdfs(pdfFiles);
    if (protectedNames.length > 0) {
      toast.error(
        `Password-protected PDFs cannot be uploaded: ${protectedNames.join(", ")}`
      );
    }
    const toAdd = [...validPdfs, ...nonPdfFiles];
    if (toAdd.length === 0) return;

    const newItems: FileItem[] = toAdd.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "uploading",
    }));

    setFileItems((prev) => [...prev, ...newItems]);
    toast.success(`Added ${newItems.length} file${newItems.length > 1 ? "s" : ""} — uploading...`);

    newItems.forEach((item) => {
      const mediaType =
        item.file.type ||
        (item.file.name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");

      const promise = uploadFileDirect(item.file)
        .then(({ url, filename }) => {
          setFileItems((prev) => {
            const existing = prev.find((i) => i.id === item.id);
            if (!existing) return prev;
            return prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "ready" as const,
                    result: {
                      url,
                      mediaType,
                      filename: filename || i.file.name,
                      fileSize: i.file.size,
                    },
                  }
                : i
            );
          });
        })
        .catch((err) => {
          setFileItems((prev) => {
            const existing = prev.find((i) => i.id === item.id);
            if (!existing) return prev;
            return prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: "error" as const,
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : i
            );
          });
          toast.error(`Failed to upload ${item.file.name}`);
        })
        .finally(() => {
          uploadPromisesRef.current.delete(item.id);
        });

      uploadPromisesRef.current.set(item.id, promise);
    });
  }, [fileItems]);

  const removeFile = useCallback((index: number) => {
    setFileItems((prev) => {
      const item = prev[index];
      if (item) uploadPromisesRef.current.delete(item.id);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const addLink = useCallback((url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;

    try {
      new URL(trimmed);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    if (links.length >= MAX_LINKS) {
      toast.error(`Maximum ${MAX_LINKS} links allowed`);
      return;
    }

    if (isYouTubeUrl(trimmed) && hasYouTubeLink) {
      toast.error("Only one YouTube video allowed");
      return;
    }

    if (links.includes(trimmed)) {
      toast.error("This link is already added");
      return;
    }

    setLinks((prev) => [...prev, trimmed]);
    toast.success("Link added");
  }, [links, hasYouTubeLink]);

  const removeLink = useCallback((index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearAll = useCallback(() => {
    uploadPromisesRef.current.clear();
    setFileItems([]);
    setLinks([]);
  }, []);

  const awaitAllUploads = useCallback(() => {
    const promises = Array.from(uploadPromisesRef.current.values());
    return Promise.all(promises).then(() => {});
  }, []);

  const value = useMemo<HomeAttachmentsContextValue>(
    () => ({
      fileItems,
      files,
      links,
      addFiles,
      removeFile,
      addLink,
      removeLink,
      clearAll,
      totalFileSize,
      hasYouTubeLink,
      canAddMoreLinks,
      canAddYouTube,
      hasUploading,
      awaitAllUploads,
    }),
    [
      fileItems,
      files,
      links,
      addFiles,
      removeFile,
      addLink,
      removeLink,
      clearAll,
      totalFileSize,
      hasYouTubeLink,
      canAddMoreLinks,
      canAddYouTube,
      hasUploading,
      awaitAllUploads,
    ]
  );

  return (
    <HomeAttachmentsContext.Provider value={value}>
      {children}
    </HomeAttachmentsContext.Provider>
  );
}

export function useHomeAttachments() {
  const ctx = useContext(HomeAttachmentsContext);
  if (!ctx) {
    throw new Error(
      "useHomeAttachments must be used within HomeAttachmentsProvider"
    );
  }
  return ctx;
}

export const ATTACHMENTS_SESSION_KEY = "thinkex-autogen-attachments";
export { MAX_TOTAL_FILE_BYTES, MAX_LINKS, isYouTubeUrl };
