"use client";

import { useState, useRef, useEffect } from "react";
import { HomePromptInput } from "./HomePromptInput";
import { DynamicTagline } from "./DynamicTagline";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { HomeTopBar } from "./HomeTopBar";
import { FloatingWorkspaceCards } from "@/components/landing/FloatingWorkspaceCards";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderPlus } from "lucide-react";

export function HomeContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scrollY, setScrollY] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => {
      if (scrollRef.current) {
        setScrollY(scrollRef.current.scrollTop);
      }
    };

    const el = scrollRef.current;
    el?.addEventListener("scroll", handleScroll);
    return () => el?.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCreateBlankWorkspace = async () => {
    try {
      const createRes = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Blank Workspace",
          icon: null,
          color: null,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create workspace");
      }
      const { workspace } = (await createRes.json()) as { workspace: { slug: string } };

      // Invalidate workspaces cache so the new workspace is available immediately
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });

      router.push(`/workspace/${workspace.slug}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Could not create workspace", { description: msg });
    }
  };

  return (
    <>
      {/* Fixed Top Bar */}
      <HomeTopBar
        scrollY={scrollY}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Scrollable Content - scroll-pt-20 creates 80px hero peek when snapped to workspaces */}
      <div ref={scrollRef} className="relative h-full w-full overflow-y-auto snap-y snap-mandatory scroll-pt-20">
        {/* Floating Card Background */}
        <div className="absolute inset-0 z-0 select-none pointer-events-none overflow-hidden">
          <FloatingWorkspaceCards
            bottomGradientHeight="40%"
            opacity="opacity-10 md:opacity-15"
            includeExtraCards={true}
          />
        </div>

        {/* Hero Section - Full screen height, vertically centered */}
        <div className="relative z-10 h-screen flex flex-col items-center justify-center text-center px-6 snap-start">
          <div className="w-full max-w-2xl relative">
            {/* Subtle ambient blur behind hero content */}
            <div
              className="absolute -inset-8 rounded-3xl pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.3) 40%, transparent 70%)',
                filter: 'blur(20px)',
                zIndex: 0,
              }}
            />

            {/* Dynamic tagline with mask wipe animation */}
            <div className="mb-6 relative z-10">
              <DynamicTagline />
            </div>
            <div className="flex justify-center w-full relative z-10">
              <HomePromptInput />
            </div>

            {/* Start from scratch button */}
            <div className="flex justify-center w-full relative z-10 mt-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreateBlankWorkspace}
                className="text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-200 gap-2"
              >
                <FolderPlus className="h-4 w-4" />
                Or, start from scratch
              </Button>
            </div>
          </div>
        </div>

        {/* Workspaces Section - Full screen, padding for top bar */}
        <div className="relative z-10 px-6 pb-8 pt-24 min-h-screen snap-start">
          <div className="w-full max-w-6xl mx-auto space-y-12">
            {/* Your Workspaces */}
            <div className="bg-sidebar rounded-md p-6">
              <h2 className="text-lg font-normal text-muted-foreground mb-4">Recent workspaces</h2>
              <WorkspaceGrid searchQuery={searchQuery} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
