"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { WorkspaceInstructionModal } from "@/components/onboarding/WorkspaceInstructionModal";
import { Button } from "@/components/ui/button";
import { HomeLayout } from "@/components/layout/HomeLayout";
import { AnonymousSessionHandler } from "@/components/layout/SessionHandler";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { MobileWarning } from "@/components/ui/MobileWarning";
import { FloatingWorkspaceCards } from "@/components/landing/FloatingWorkspaceCards";
import { ATTACHMENTS_SESSION_KEY } from "@/contexts/HomeAttachmentsContext";

const PROGRESS_LABELS: Record<string, string> = {
  metadata: "Generating workspace title...",
  workspace: "Creating your workspace...",
  note: "Creating your note...",
  quiz: "Creating your quiz...",
  flashcards: "Creating your flashcards...",
  youtube: "Adding a video...",
  complete: "Done! Opening your workspace...",
};

const PROGRESS_STEPS = ["metadata", "workspace", "note", "quiz", "flashcards", "youtube"] as const;

function GenerateContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const prompt = searchParams.get("prompt")?.trim();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progressText, setProgressText] = useState("Your workspace is generating...");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const runAutogen = useCallback(async () => {
    if (!prompt) return;

    setError(null);
    setIsLoading(true);
    setCompletedSteps([]);
    setProgressText("Generating workspace title...");

    let fileUrls: Array<{ url: string; mediaType: string; filename?: string; fileSize?: number }> = [];
    let links: string[] = [];
    try {
      const stored = sessionStorage.getItem(ATTACHMENTS_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          fileUrls?: typeof fileUrls;
          links?: string[];
        };
        fileUrls = parsed.fileUrls ?? [];
        links = parsed.links ?? [];
        sessionStorage.removeItem(ATTACHMENTS_SESSION_KEY);
      }
    } catch {
      // Ignore parse errors
    }

    try {
      const res = await fetch("/api/workspaces/autogen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          ...(fileUrls.length > 0 && { fileUrls }),
          ...(links.length > 0 && { links }),
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create workspace");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as {
              type: string;
              data?: {
                message?: string;
                workspace?: { slug?: string };
                step?: string;
                stage?: string;
                partial?: Record<string, unknown>;
              };
            };

            if (ev.type === "partial" && ev.data?.partial) {
              const p = ev.data.partial as Record<string, unknown>;
              const stage = ev.data.stage as string;
              if (stage === "metadata" && typeof p.title === "string" && p.title) {
                setProgressText(`Workspace: ${p.title}${p.icon || p.color ? "..." : ""}`);
              } else if (stage === "distillation" && p.metadata && typeof (p.metadata as Record<string, unknown>).title === "string") {
                const t = (p.metadata as Record<string, unknown>).title as string;
                if (t) setProgressText(`Workspace: ${t}...`);
              } else if (stage === "noteFlashcards") {
                const note = p.note as Record<string, unknown> | undefined;
                const fc = p.flashcards as Record<string, unknown> | undefined;
                if (typeof note?.title === "string" && note.title) {
                  setProgressText(`Creating note: ${note.title}...`);
                } else if (typeof fc?.title === "string" && fc.title) {
                  setProgressText(`Creating flashcards: ${fc.title}...`);
                }
              }
            } else if (ev.type === "metadata") {
              setCompletedSteps((s) => [...s, "metadata"]);
              setProgressText(PROGRESS_LABELS.workspace);
            } else if (ev.type === "workspace") {
              setCompletedSteps((s) => [...s, "workspace"]);
              setProgressText("Creating your note, quiz, flashcards, and video...");
            } else if (ev.type === "progress" && ev.data?.step) {
              const step = ev.data.step;
              setCompletedSteps((s) => [...s, step]);
              setProgressText(PROGRESS_LABELS[step] ?? `Creating ${step}...`);
            } else if (ev.type === "complete" && ev.data?.workspace?.slug) {
              setProgressText(PROGRESS_LABELS.complete);
              await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
              router.replace(`/workspace/${ev.data.workspace.slug}`);
              return;
            } else if (ev.type === "error" && ev.data?.message) {
              setError(ev.data.message);
              return;
            }
          } catch (_) {
            // Skip malformed lines
          }
        }
      }

      // Stream ended without complete event
      setError("Invalid response from server");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [prompt, router, queryClient]);

  useEffect(() => {
    if (!prompt) {
      router.replace("/home");
      return;
    }
    runAutogen();
  }, [prompt, router, runAutogen]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  if (!prompt) {
    return null; // Redirecting
  }

  return (
    <div className="relative min-h-screen w-full">
      {/* Floating card background — fixed so it covers viewport behind modal */}
      <div className="fixed inset-0 z-[1] select-none pointer-events-none">
        <FloatingWorkspaceCards bottomGradientHeight="50%" includeExtraCards clearerBackground />
      </div>

      <div className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center">
        <WorkspaceInstructionModal
          mode="first-open"
          open={!error}
          canClose={false}
          showFallback={false}
          isGenerating={isLoading && !error}
          progressText={progressText}
          completedSteps={completedSteps}
          totalSteps={PROGRESS_STEPS.length}
        />
      {error && (
        <div className="flex flex-col items-center gap-4 p-6 bg-background/80 backdrop-blur-sm rounded-xl border border-border/50">
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={runAutogen}>
              Retry
            </Button>
            <Button variant="default" onClick={() => router.replace("/home")}>
              Back to home
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <>
      <MobileWarning />
      <AnonymousSessionHandler>
        <WorkspaceProvider>
          <HomeLayout>
            <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center">Loading...</div>}>
              <GenerateContent />
            </Suspense>
          </HomeLayout>
        </WorkspaceProvider>
      </AnonymousSessionHandler>
    </>
  );
}
