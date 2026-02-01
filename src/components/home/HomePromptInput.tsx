"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCreateWorkspaceFromPrompt } from "@/hooks/workspace/use-create-workspace";
import { usePdfUpload } from "@/hooks/workspace/use-pdf-upload";
import { ArrowUp, Loader2, X, FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import TypingText from "@/components/ui/typing-text";
import { useDropzone } from "react-dropzone";
import type { PdfData } from "@/lib/workspace-state/types";

const PLACEHOLDER_OPTIONS = [
  "Calc 3 double integrals",
  "planning a 2 week trip to Japan",
  "APUSH Native American history",
  "building a home workout routine",
  "research on Pablo Picasso's paintings",
  "starting a dropshipping business",
  "learning React hooks and state",
  "meal prepping for the week",
  "organic chemistry reaction mechanisms",
  "training for my first marathon",
  "To Kill a Mockingbird analysis",
  "planning my wedding budget",
  "basic algebra word problems",
  "redecorating my living room",
  "learning Spanish verb conjugations",
  "learning to invest in index funds",
  "World War II European theater",
  "planning a surprise birthday party",
  "intro to Python programming",
  "starting a YouTube channel",
  "AP Bio cellular respiration",
  "building my personal portfolio site",
  "high school geometry proofs",
  "tracking my monthly expenses",
  "solar system planets and moons",
  "planning a camping trip to Yosemite",
  "learning guitar chord progressions",
  "organizing my home office",
  "French Revolution causes and effects",
  "beginner photography composition",
  "statistics hypothesis testing",
  "comparing Monet and Van Gogh",
  "US Presidents and their policies",
  "physics kinematics problems",
];

const baseText = "Create a workspace for ";

interface HomePromptInputProps {
  shouldFocus?: boolean;
}

export function HomePromptInput({ shouldFocus }: HomePromptInputProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const typingKeyRef = useRef(0);

  const createFromPrompt = useCreateWorkspaceFromPrompt();
  const { uploadFiles, uploadedFiles, isUploading, removeFile, clearFiles } = usePdfUpload();

  // Setup drop zone for PDF files
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: true,
    noClick: true, // Don't open file dialog on click (only on drag)
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        try {
          await uploadFiles(acceptedFiles);
          toast.success(`Uploaded ${acceptedFiles.length} PDF${acceptedFiles.length > 1 ? 's' : ''}`);
        } catch (error) {
          toast.error("Failed to upload PDFs");
        }
      }
    },
  });

  // Shuffle options with random start for variety
  const shuffledOptions = useMemo(() => {
    const start = Math.floor(Math.random() * PLACEHOLDER_OPTIONS.length);
    return [
      ...PLACEHOLDER_OPTIONS.slice(start),
      ...PLACEHOLDER_OPTIONS.slice(0, start),
    ];
  }, []);

  // Focus input when hero section becomes visible
  useEffect(() => {
    if (shouldFocus && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldFocus]);

  // Handle user typing - stop animation
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = value.trim();
    if (!prompt || createFromPrompt.isLoading) return;

    // Construct initial state with PDF cards AND empty placeholder cards if files were uploaded
    let initialState = undefined;
    if (uploadedFiles.length > 0) {
      // Calculate total PDF height (each PDF takes 10 rows)
      const pdfHeight = 10;
      const totalPdfY = uploadedFiles.length * pdfHeight;

      // Create PDF card items from uploaded files (stacked vertically at top)
      const pdfItems = uploadedFiles.map((file, index) => ({
        id: crypto.randomUUID(),
        type: 'pdf' as const,
        name: file.name,
        subtitle: '',
        color: '#6366F1' as const, // Indigo for PDFs
        layout: { x: 0, y: index * pdfHeight, w: 4, h: pdfHeight },
        lastSource: 'user' as const,
        data: {
          fileUrl: file.fileUrl,
          filename: file.filename,
          fileSize: file.fileSize,
        } as PdfData,
      }));

      // Create empty placeholder cards with fixed layout and colors
      const noteId = crypto.randomUUID();
      const quizId = crypto.randomUUID();
      const flashcardId = crypto.randomUUID();

      const emptyNote = {
        id: noteId,
        type: 'note' as const,
        name: 'Summary Notes',
        subtitle: 'AI will fill this from your PDFs',
        color: '#10B981' as const, // Emerald for Note
        layout: { x: 0, y: totalPdfY, w: 4, h: 13 },
        lastSource: 'user' as const,
        data: {
          blockContent: [
            {
              id: 'placeholder-block',
              type: 'paragraph',
              props: { backgroundColor: 'default', textColor: 'default', textAlignment: 'left' },
              content: [],
              children: [],
            },
          ],
          field1: '',
        },
      };

      const emptyQuiz = {
        id: quizId,
        type: 'quiz' as const,
        name: 'Quiz',
        subtitle: 'AI will generate questions from your PDFs',
        color: '#F59E0B' as const, // Amber for Quiz
        layout: { x: 0, y: totalPdfY + 13, w: 2, h: 13 },
        lastSource: 'user' as const,
        data: {
          questions: [],
        },
      };

      const emptyFlashcard = {
        id: flashcardId,
        type: 'flashcard' as const,
        name: 'Flashcards',
        subtitle: 'AI will create study cards from your PDFs',
        color: '#EC4899' as const, // Pink for Flashcards
        layout: { x: 2, y: totalPdfY + 13, w: 2, h: 8 },
        lastSource: 'user' as const,
        data: {
          cards: [],
        },
      };

      const allItems = [...pdfItems, emptyNote, emptyQuiz, emptyFlashcard];

      initialState = {
        workspaceId: '', // Will be set by backend
        globalTitle: '',
        globalDescription: '',
        items: allItems,
        itemsCreated: allItems.length,
      };
    }

    createFromPrompt.mutate(prompt, {
      template: uploadedFiles.length > 0 ? "blank" : "getting_started", // Use blank template if PDFs provided
      initialState,
      onSuccess: (workspace) => {
        // Reset typing animation by changing key
        typingKeyRef.current += 1;
        // Clear uploaded files
        clearFiles();
        const url = `/workspace/${workspace.slug}`;
        const params = new URLSearchParams();

        if (uploadedFiles.length > 0) {
          params.set('action', 'generate_study_materials');
        } else {
          params.set('createFrom', prompt);
        }

        router.push(`${url}?${params.toString()}`);
      },
      onError: (err) => {
        toast.error("Could not create workspace", { description: err.message });
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="relative" {...getRootProps()}>
        <input {...getInputProps()} />

        {/* Drag overlay */}
        {isDragActive && (
          <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed border-white/40 bg-background/90 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 text-white/80">
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">Drop PDFs here</p>
            </div>
          </div>
        )}

        {/* Uploaded files display */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {uploadedFiles.map((file) => (
              <div
                key={file.fileUrl}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-1.5",
                  "bg-white/5 border border-white/10",
                  "text-sm text-white/80"
                )}
              >
                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate max-w-[200px]">{file.filename}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(file.fileUrl);
                  }}
                  className="ml-1 hover:text-white transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input container styled to look like one input */}
        <div
          onClick={() => inputRef.current?.focus()}
          className={cn(
            "relative flex items-center gap-0 min-h-[56px] w-full",
            "bg-background/80 backdrop-blur-xl",
            "border border-white/10 rounded-xl",
            "shadow-[0_0_60px_-15px_rgba(255,255,255,0.1)]",
            "focus-within:shadow-[0_0_80px_-10px_rgba(255,255,255,0.15)]",
            "focus-within:border-white/60",
            "transition-all duration-300",
            "cursor-text"
          )}
        >
          {/* Prefix label */}
          <span
            id="workspace-prompt-label"
            className={cn(
              "text-lg text-foreground whitespace-nowrap flex-shrink-0",
              "pl-4 pr-0"
            )}
            style={{ fontSize: '1.125rem', lineHeight: '1.75rem' }}
          >
            {baseText}
          </span>

          {/* Input field */}
          <div className="relative flex-1 min-w-0">
            <Input
              ref={inputRef}
              value={value}
              onChange={handleInput}
              placeholder=""
              maxLength={300}
              autoFocus
              aria-labelledby="workspace-prompt-label"
              style={{
                fontSize: '1.125rem',
                lineHeight: '1.75rem',
                height: 'auto',
                minHeight: '60px',
                paddingTop: '1rem',
                paddingBottom: '1rem',
                paddingLeft: '0.25rem',
                paddingRight: '3.5rem'
              }}
              className={cn(
                "w-full border-0",
                "focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                "!text-lg md:!text-lg",
                "bg-transparent dark:bg-transparent",
                "h-auto"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            {/* Typing placeholder - dimmer for contrast with white prefix */}
            {!value && (
              <div
                className={cn(
                  "absolute inset-0 flex items-center pointer-events-none",
                  "pl-2 pr-14",
                  "text-lg text-muted-foreground/50"
                )}
                style={{
                  willChange: 'transform',
                  fontSize: '1.125rem',
                  lineHeight: '1.75rem',
                  transform: 'translateX(-4px)'
                }}
              >
                <TypingText
                  key={typingKeyRef.current}
                  text={shuffledOptions}
                  typingSpeed={35}
                  deletingSpeed={25}
                  pauseDuration={2500}
                  loop={true}
                  showCursor={false}
                  className=""
                />
              </div>
            )}

            {/* Submit arrow */}
            <button
              type="submit"
              disabled={!value.trim() || createFromPrompt.isLoading}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "absolute right-3 top-1/2 -translate-y-1/2 z-20",
                "p-1 transition-opacity duration-200",
                "disabled:opacity-30 disabled:cursor-not-allowed",
                "hover:opacity-80"
              )}
            >
              {createFromPrompt.isLoading ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <ArrowUp className="h-6 w-6 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
