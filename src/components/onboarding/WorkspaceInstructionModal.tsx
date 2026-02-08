"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Move, SquarePen, FileSearch, Youtube, Share2, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkspaceInstructionMode } from "@/hooks/workspace/use-workspace-instruction-modal";

export interface WorkspaceInstructionModalProps {
  mode: WorkspaceInstructionMode;
  open: boolean;
  canClose: boolean;
  showFallback: boolean;
  onRequestClose?: () => void;
  onFallbackContinue?: () => void;
  onUserInteracted?: () => void;
  isGenerating?: boolean;
  mediaSrc?: string;
  useStaticFallback?: boolean;
}

interface Step {
  icon: typeof Move;
  label: string;
  description: string;
  /** When set, shows "Method X of Y" badge on the slide */
  variant?: { current: number; total: number };
  video?: { dark: string; light: string };
}

const VIDEO_BASE = "https://uxcoymwbfcbvkgwbhttq.supabase.co/storage/v1/object/public/video";

const STEPS: Step[] = [
  {
    icon: Move,
    label: "Arrange your materials",
    description: "Drag, resize, and organize cards on your workspace grid to build your layout.",
    video: { dark: `${VIDEO_BASE}/step-1-arrange-dark.mp4`, light: `${VIDEO_BASE}/step-1-arrange-light.mp4` },
  },
  {
    icon: SquarePen,
    label: "Generate notes as you go",
    description: "Type a prompt and let the AI create a complete set of study materials for you.",
    variant: { current: 1, total: 3 },
    video: { dark: `${VIDEO_BASE}/step-2-generate-card-dark-1.mp4`, light: `${VIDEO_BASE}/step-2-generate-card-light-1.mp4` },
  },
  {
    icon: SquarePen,
    label: "Generate notes as you go",
    description: "Select existing cards and ask the AI to generate notes based on their content.",
    variant: { current: 2, total: 3 },
    video: { dark: `${VIDEO_BASE}/step-2-generate-card-dark-2.mp4`, light: `${VIDEO_BASE}/step-2-generate-card-light-2.mp4` },
  },
  {
    icon: SquarePen,
    label: "Generate notes as you go",
    description: "Upload a PDF and have the AI automatically create summaries and study guides.",
    variant: { current: 3, total: 3 },
    video: { dark: `${VIDEO_BASE}/step-2-generate-card-dark-3.mp4`, light: `${VIDEO_BASE}/step-2-generate-card-light-3.mp4` },
  },
  {
    icon: FileSearch,
    label: "Ask AI about your documents",
    description: "Select cards and chat with the AI to get answers grounded in your materials.",
    video: { dark: `${VIDEO_BASE}/step-3-pdf-ss-dark.mp4`, light: `${VIDEO_BASE}/step-3-pdf-ss-light.mp4` },
  },
  {
    icon: Youtube,
    label: "Drop in lecture videos",
    description: "Paste a YouTube link or drag it in to add lecture videos alongside your notes.",
    video: { dark: `${VIDEO_BASE}/step-4-youtube-dark.mp4`, light: `${VIDEO_BASE}/step-4-youtube-light.mp4` },
  },
  {
    icon: Share2,
    label: "Collaborate with others",
    description: "Share your workspace with classmates or teammates to work together in real time.",
    video: { dark: `${VIDEO_BASE}/step-5-collab-dark.mp4`, light: `${VIDEO_BASE}/step-5-collab-light.mp4` },
  },
];

const ICON_SLIDE_MS = 4000;
const FADE_MS = 250;

function useCarousel(open: boolean) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";

  // Reset carousel state when modal closes so re-opening starts from slide 0
  useEffect(() => {
    if (!open) {
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
      setActiveIndex(0);
      setVisibleIndex(0);
      setFading(false);
      setVideoLoaded(false);
      pausedRef.current = false;
    }
  }, [open]);

  // Transition: fade out → swap → fade in
  const transitionTo = useCallback((nextIndex: number) => {
    if (nextIndex === visibleIndex) return;
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    setFading(true);
    setVideoLoaded(false);
    fadeTimeoutRef.current = setTimeout(() => {
      setActiveIndex(nextIndex);
      setVisibleIndex(nextIndex);
      setFading(false);
      fadeTimeoutRef.current = null;
    }, FADE_MS);
  }, [visibleIndex]);

  const advance = useCallback(() => {
    if (pausedRef.current) return;
    transitionTo((visibleIndex + 1) % STEPS.length);
  }, [transitionTo, visibleIndex]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const goTo = useCallback((index: number) => {
    transitionTo(index);
  }, [transitionTo]);

  const goPrev = useCallback(() => {
    transitionTo((visibleIndex - 1 + STEPS.length) % STEPS.length);
  }, [transitionTo, visibleIndex]);

  const goNext = useCallback(() => {
    transitionTo((visibleIndex + 1) % STEPS.length);
  }, [transitionTo, visibleIndex]);

  const handleVideoEnded = useCallback(() => {
    // Always auto-advance on video end, even if user has interacted (paused)
    transitionTo((visibleIndex + 1) % STEPS.length);
  }, [transitionTo, visibleIndex]);

  const handleVideoCanPlay = useCallback(() => {
    setVideoLoaded(true);
  }, []);

  // Start fallback timer for icon-only slides (video slides use key + autoPlay)
  useEffect(() => {
    if (!open) return;
    const step = STEPS[activeIndex];
    if (!step.video) {
      fallbackTimerRef.current = setTimeout(advance, ICON_SLIDE_MS);
    }

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [open, activeIndex, advance]);

  const step = STEPS[activeIndex];
  const videoSrc = step.video ? (isDark ? step.video.dark : step.video.light) : null;

  // Compute next slide's video src for preloading
  const nextStep = STEPS[(activeIndex + 1) % STEPS.length];
  const nextVideoSrc = nextStep.video ? (isDark ? nextStep.video.dark : nextStep.video.light) : null;

  // Preload the next video so transitions are instant
  useEffect(() => {
    if (!open || !nextVideoSrc) return;
    const preloadVideo = document.createElement("video");
    preloadVideo.preload = "auto";
    preloadVideo.src = nextVideoSrc;
    preloadVideo.load();
    return () => {
      preloadVideo.src = "";
      preloadVideo.load();
    };
  }, [open, nextVideoSrc]);

  return { activeIndex, step, videoSrc, nextVideoSrc, fading, videoLoaded, goTo, goPrev, goNext, handleVideoEnded, handleVideoCanPlay, pause };
}

export function WorkspaceInstructionModal({
  mode,
  open,
  canClose,
  showFallback,
  onRequestClose,
  onFallbackContinue,
  onUserInteracted,
  isGenerating,
}: WorkspaceInstructionModalProps) {
  const carousel = useCarousel(open);
  const { activeIndex, step, videoSrc, fading, videoLoaded, goTo, goPrev, goNext, handleVideoEnded, handleVideoCanPlay, pause } = carousel;
  const Icon = step.icon;

  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
    } else if (isVisible) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (mode === "first-open" && canClose) {
          onRequestClose?.();
        } else if (mode === "autogen" && (!isGenerating || showFallback)) {
          onFallbackContinue?.();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, mode, canClose, isGenerating, showFallback, onRequestClose, onFallbackContinue]);

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-4 py-6 backdrop-blur-[2px] transition-opacity duration-300 ease-out",
        isClosing ? "opacity-0" : "opacity-100"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Workspace instruction"
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        onClick={() => { pause(); onUserInteracted?.(); }}
        className={cn(
          "w-full max-w-[1100px] rounded-[28px] border border-sidebar-border/70 bg-sidebar p-2 shadow-[0_28px_100px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out",
          isClosing ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100"
        )}
      >
        <div className="flex h-[620px] flex-col rounded-[24px] border border-sidebar-border bg-sidebar/95">
          {/* Generation status banner (autogen only) */}
          {mode === "autogen" && (
            <div className="flex items-center gap-2.5 rounded-t-[24px] border-b border-sidebar-border bg-primary/10 px-5 py-2.5">
              <div className={cn("h-2 w-2 rounded-full", !isGenerating ? "bg-green-500" : "bg-primary animate-pulse")} />
              <span className="text-sm font-medium text-primary">
                {!isGenerating ? "Your workspace is ready" : "Generating your workspace..."}
              </span>
            </div>
          )}

          {/* Upper panel — video fills the space */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-[24px]">
            <div className="absolute -left-20 -top-20 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-52 w-52 rounded-full bg-accent/20 blur-3xl" />

            {/* Left chevron */}
            <button
              type="button"
              onClick={goPrev}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent/60 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              aria-label="Previous step"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Right chevron */}
            <button
              type="button"
              onClick={goNext}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent/60 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              aria-label="Next step"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Video or icon fallback */}
            <div
              className={cn(
                "relative h-full w-full transition-opacity",
                fading ? "opacity-0" : "opacity-100"
              )}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            >
              {/* Icon placeholder — shown until video is loaded */}
              <div
                className={cn(
                  "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
                  videoSrc && videoLoaded ? "opacity-0" : "opacity-100"
                )}
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-10 w-10" />
                </div>
              </div>

              {/* Video — fades in over the icon once ready */}
              {videoSrc && (
                <video
                  key={videoSrc}
                  src={videoSrc}
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  onEnded={handleVideoEnded}
                  onPlay={(e) => {
                    e.currentTarget.playbackRate = 0.7;
                    handleVideoCanPlay();
                  }}
                  className={cn(
                    "absolute inset-0 h-full w-full object-contain p-1 transition-opacity duration-300",
                    videoLoaded ? "opacity-100" : "opacity-0"
                  )}
                />
              )}
            </div>
          </div>

          {/* Lower panel — text, dots, action buttons */}
          <div className="relative flex flex-col items-center gap-1 border-t border-sidebar-border bg-sidebar px-5 pb-4 pt-3 rounded-b-[24px]">
            {/* Text block — fades with the video */}
            <div
              className={cn(
                "flex flex-col items-center gap-1 transition-opacity",
                fading ? "opacity-0" : "opacity-100"
              )}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            >
              {/* Variant badge */}
              {step.variant && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Method {step.variant.current} of {step.variant.total}
                </span>
              )}

              {/* Label */}
              <h3 className="text-lg font-semibold text-sidebar-foreground">
                {step.label}
              </h3>

              {/* Description */}
              <p className="text-center whitespace-nowrap text-sm text-sidebar-foreground/70">
                {step.description}
              </p>
            </div>

            {/* Dot navigation */}
            <div className="flex items-center justify-center gap-2 pt-2">
              {STEPS.map((s, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => goTo(index)}
                  className={cn(
                    "h-2 rounded-full transition-all duration-300",
                    index === activeIndex
                      ? "w-6 bg-primary"
                      : "w-2 bg-sidebar-foreground/25 hover:bg-sidebar-foreground/40"
                  )}
                  aria-label={`Go to slide ${index + 1}${s.variant ? ` — ${s.label} method ${s.variant.current}` : ` — ${s.label}`}`}
                />
              ))}
            </div>

            {/* CTA — vertically centered in bottom bar */}
            {mode === "first-open" && canClose && (
              <Button type="button" size="sm" onClick={onRequestClose} className="absolute right-5 top-1/2 -translate-y-1/2">
                <X className="mr-1 h-3.5 w-3.5" />
                Close
              </Button>
            )}
            {mode === "autogen" && (!isGenerating || showFallback) && (
              <Button type="button" size="sm" onClick={onFallbackContinue} className="absolute right-5 top-1/2 -translate-y-1/2">
                Continue to workspace
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
