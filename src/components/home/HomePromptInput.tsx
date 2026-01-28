"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUp, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import Typewriter, { TypewriterClass } from "typewriter-effect";

const PLACEHOLDER_OPTIONS = [
  "learning Spanish",
  "meal planning",
  "productivity tips",
  "hiking trails nearby",
  "interior design ideas",
  "beginner guitar",
  "healthy breakfast recipes",
  "weekend trip ideas",
  "mindfulness and meditation",
  "budgeting and saving",
  "home workout routines",
  "book recommendations",
  "gardening basics",
  "morning routines",
  "travel photography",
  "cooking for beginners",
  "personal finance",
  "storytelling and writing",
  "coffee brewing at home",
  "day trips and getaways",
];

const baseText = "Create a workspace for ";

export function HomePromptInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typewriterRef = useRef<TypewriterClass | null>(null);

  // Cleanup typewriter on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (typewriterRef.current) {
        typewriterRef.current.stop();
      }
    };
  }, []);

  // Handle user typing - stop animation
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (typewriterRef.current) {
      typewriterRef.current.stop();
      typewriterRef.current.deleteAll(1);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (value.length === 0 && typewriterRef.current) {
      typewriterRef.current.start();
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    toast.info("Coming soon", {
      description: "File upload for workspace creation will be available soon!",
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = value.trim();
    if (!prompt || isLoading) return;

    setIsLoading(true);
    try {
      const titleRes = await fetch("/api/workspaces/generate-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!titleRes.ok) {
        const err = await titleRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate title");
      }
      const { title } = (await titleRes.json()) as { title: string };

      const createRes = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: title }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create workspace");
      }
      const { workspace } = (await createRes.json()) as { workspace: { slug: string } };

      setValue("");
      if (typewriterRef.current) {
        typewriterRef.current.start();
      }
      router.push(
        `/dashboard/${workspace.slug}?createFrom=${encodeURIComponent(prompt)}`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error("Could not create workspace", { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl">
      <div className="relative">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Textarea */}
        <div className="relative flex-1">
          {/* File upload button - inside on the left */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleFileUpload}
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 z-10",
              "h-9 w-9",
              "hover:bg-sidebar-accent",
              "text-muted-foreground hover:text-foreground"
            )}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <Textarea
            value={value}
            onChange={handleInput}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder=""
            style={{ fontSize: '1.125rem', lineHeight: '1.75rem', paddingTop: '1rem', paddingBottom: '1rem' }}
            className={cn(
              "min-h-[60px] w-full resize-none relative z-10",
              "!text-lg md:!text-lg",
              "bg-background/50",
              "border-2 border-sidebar-border/50",
              "focus:border-primary/50 focus:bg-background/80",
              "transition-all duration-200",
              "pl-12 pr-14"
            )}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          {/* Typewriter placeholder - positioned over textarea, hidden on focus */}
          {!value && !isFocused && (
            <div
              className={cn(
                "absolute inset-0 flex items-center pointer-events-none z-[5]",
                "pl-12 pr-14",
                "text-lg text-muted-foreground"
              )}
              style={{ willChange: 'transform' }}
            >
              <Typewriter
                onInit={(typewriter) => {
                  typewriterRef.current = typewriter;
                  
                  typewriter.pasteString(baseText, null);
                  
                  const cycleOptions = () => {
                    const start = Math.floor(Math.random() * PLACEHOLDER_OPTIONS.length);
                    const ordered = [
                      ...PLACEHOLDER_OPTIONS.slice(start),
                      ...PLACEHOLDER_OPTIONS.slice(0, start),
                    ];
                    ordered.forEach((option, index) => {
                      if (index === 0) {
                        typewriter.typeString(option);
                      } else {
                        const prevLen = ordered[index - 1].length;
                        typewriter
                          .pauseFor(2000)
                          .deleteChars(prevLen)
                          .typeString(option);
                      }
                    });
                    const lastLen = ordered[ordered.length - 1].length;
                    typewriter
                      .pauseFor(2000)
                      .deleteChars(lastLen)
                      .callFunction(() => {
                        cycleOptions();
                      });
                  };
                  
                  cycleOptions();
                  typewriter.start();
                }}
                options={{
                  delay: 20,
                  deleteSpeed: 8,
                  cursor: "",
                  loop: false,
                }}
              />
            </div>
          )}

          {/* Submit button - inside on the right */}
          <Button
            type="submit"
            size="icon"
            disabled={!value.trim() || isLoading}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 z-20",
              "h-9 w-9 rounded-full",
              "bg-primary hover:bg-primary/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ArrowUp className="h-4 w-4 text-gray-900 dark:text-gray-600" />
          </Button>
        </div>
      </div>
    </form>
  );
}
