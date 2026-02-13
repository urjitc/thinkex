import { NextRequest } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { z } from "zod";
import { randomUUID } from "crypto";
import { desc, eq, sql } from "drizzle-orm";
import { requireAuthWithUserInfo } from "@/lib/api/workspace-helpers";
import { db, workspaces } from "@/lib/db/client";
import { generateSlug } from "@/lib/workspace/slug";
import { workspaceWorker, quizWorker } from "@/lib/ai/workers";
import { searchVideos } from "@/lib/youtube";
import { CANVAS_CARD_COLORS } from "@/lib/workspace-state/colors";

const MAX_TITLE_LENGTH = 60;

// HeroIcons that make sense as workspace topics (study, projects, subjects). No UI/settings/redundant.
const AVAILABLE_ICONS = [
  "AcademicCapIcon", "ArchiveBoxIcon", "AtSymbolIcon", "BanknotesIcon", "BeakerIcon", "BellIcon", "BoltIcon",
  "BookOpenIcon", "BookmarkIcon", "BriefcaseIcon", "BugAntIcon", "BuildingLibraryIcon", "BuildingOfficeIcon", "BuildingStorefrontIcon",
  "CakeIcon", "CalculatorIcon", "CalendarDaysIcon", "CalendarIcon", "CameraIcon", "ChartBarIcon", "ChartPieIcon",
  "ChatBubbleLeftIcon", "CircleStackIcon", "ClipboardDocumentIcon", "ClockIcon", "CloudIcon", "CodeBracketIcon",
  "CommandLineIcon", "ComputerDesktopIcon", "CpuChipIcon", "CreditCardIcon", "CubeIcon",
  "CurrencyDollarIcon", "CurrencyEuroIcon", "CurrencyPoundIcon", "CurrencyYenIcon",
  "DocumentIcon", "DocumentTextIcon", "EnvelopeIcon", "FilmIcon", "FireIcon", "FlagIcon", "FolderIcon", "FolderOpenIcon",
  "GiftIcon", "GlobeAltIcon", "GlobeAmericasIcon", "GlobeAsiaAustraliaIcon", "GlobeEuropeAfricaIcon", "HashtagIcon", "HeartIcon",
  "HomeIcon", "InboxIcon", "LanguageIcon", "LightBulbIcon", "LinkIcon", "MapIcon", "MapPinIcon", "MegaphoneIcon",
  "MicrophoneIcon", "MusicalNoteIcon", "NewspaperIcon", "PaintBrushIcon", "PaperAirplaneIcon", "PencilIcon", "PhotoIcon",
  "PlayCircleIcon", "PlayIcon", "PresentationChartLineIcon", "PuzzlePieceIcon", "QuestionMarkCircleIcon", "RadioIcon",
  "RectangleStackIcon", "RocketLaunchIcon", "RssIcon", "ScaleIcon", "ServerIcon", "ShareIcon",
  "ShoppingBagIcon", "ShoppingCartIcon", "SparklesIcon", "SpeakerWaveIcon", "Square2StackIcon", "Squares2X2Icon",
  "StarIcon", "TableCellsIcon", "TagIcon", "TrophyIcon", "TvIcon", "UserGroupIcon", "UsersIcon", "VideoCameraIcon", "ViewColumnsIcon",
  "WrenchIcon",
];

/** Layout positions for autogen items (matches desired workspace arrangement) */
const AUTOGEN_LAYOUTS = {
  youtube: { x: 0, y: 0, w: 2, h: 7 },
  flashcard: { x: 2, y: 0, w: 2, h: 5 },
  note: { x: 2, y: 5, w: 1, h: 4 },
  quiz: { x: 0, y: 7, w: 2, h: 13 },
} as const;

/** System prompt for note + flashcard generation. Aligns with formatWorkspaceContext FORMATTING (markdown, math, mermaid). */
const NOTE_FLASHCARD_SYSTEM = `You generate a study note and a flashcard deck for ThinkEx. Both must be on the same topic and use consistent formatting.

FORMATTING (apply to both note content and flashcard front/back text):
- Use Markdown (GFM): headers, lists, bold/italic, code, links.
- MATH: Use $$...$$ for all math (inline and block). Inline: $$E = mc^2$$ on the same line as text. Block: put $$...$$ on its own lines for centered display, e.g.
  $$
  \\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
  $$
  For currency use a single $ with no closing $ (e.g. $19.99).

Output a complete note (title + markdown content) and 5–8 flashcard pairs (front, back) that reinforce the same material.`;

type StreamEvent =
  | { type: "metadata"; data: { title: string; icon: string; color: string } }
  | { type: "workspace"; data: { id: string; slug: string; name: string } }
  | { type: "progress"; data: { step: "note" | "quiz" | "flashcards" | "youtube"; status: "done" } }
  | { type: "complete"; data: { workspace: { id: string; slug: string; name: string } } }
  | { type: "error"; data: { message: string } };

function streamEvent(ev: StreamEvent): string {
  return JSON.stringify(ev) + "\n";
}

/**
 * Generate workspace metadata (title, icon, color) from a prompt
 */
async function generateWorkspaceMetadata(prompt: string) {
  const { output } = await generateText({
    model: google("gemini-2.5-flash-lite"),
    output: Output.object({
      name: "WorkspaceMetadata",
      description: "Workspace title, icon, and color for a topic",
      schema: z.object({
        title: z.string().describe("A short, concise workspace title (max 5-6 words)"),
        icon: z.string().describe("A HeroIcon name that represents the topic"),
        color: z.string().describe("A hex color code that fits the topic theme"),
      }),
    }),
    system: `You are a helpful assistant that generates workspace metadata.
Given a user's prompt, generate:
1. A short, concise workspace title (max 5-6 words)
2. An appropriate HeroIcon name from: ${AVAILABLE_ICONS.join(", ")}
3. A hex color code that matches the topic theme (e.g. #3B82F6)`,
    prompt: `User prompt: "${prompt}"\n\nGenerate workspace title, icon, and color.`,
  });

  let title = output.title.trim();
  if (title.length > MAX_TITLE_LENGTH) title = title.substring(0, MAX_TITLE_LENGTH).trim();
  if (!title) title = "New Workspace";

  let icon = output.icon;
  if (!icon || !AVAILABLE_ICONS.includes(icon)) icon = "FolderIcon";

  let color = output.color;
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    color = CANVAS_CARD_COLORS[Math.floor(Math.random() * CANVAS_CARD_COLORS.length)];
  }

  return { title, icon, color };
}

/**
 * POST /api/workspaces/autogen
 * Create a workspace with AI-generated content. Streams progress events.
 */
export async function POST(request: NextRequest) {
  // Auth before streaming (throws NextResponse on 401)
  let user;
  try {
    user = await requireAuthWithUserInfo();
  } catch (e) {
    return e as Response;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (ev: StreamEvent) => {
        controller.enqueue(encoder.encode(streamEvent(ev)));
      };

      try {
        const userId = user!.userId;

        let body: { prompt?: string };
        try {
          body = await request.json();
        } catch {
          send({ type: "error", data: { message: "Invalid JSON payload" } });
          controller.close();
          return;
        }

        const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
        if (!prompt) {
          send({ type: "error", data: { message: "prompt is required" } });
          controller.close();
          return;
        }

        // 1. Generate metadata and stream immediately
        const { title, icon, color } = await generateWorkspaceMetadata(prompt);
        send({ type: "metadata", data: { title, icon, color } });

        // 2. Create workspace
        const maxSortData = await db
          .select({ sortOrder: workspaces.sortOrder })
          .from(workspaces)
          .where(eq(workspaces.userId, userId))
          .orderBy(desc(workspaces.sortOrder))
          .limit(1);

        const newSortOrder = (maxSortData[0]?.sortOrder ?? -1) + 1;

        let workspace;
        let attempts = 0;
        const MAX_ATTEMPTS = 5;

        while (attempts < MAX_ATTEMPTS) {
          try {
            const slug = generateSlug(title);
            [workspace] = await db
              .insert(workspaces)
              .values({
                userId,
                name: title,
                description: "",
                template: "blank",
                isPublic: false,
                icon,
                color,
                sortOrder: newSortOrder,
                slug,
              })
              .returning();
            break;
          } catch (error: unknown) {
            const err = error as { code?: string };
            if (err?.code === "23505") {
              attempts++;
              if (attempts >= MAX_ATTEMPTS) throw error;
              continue;
            }
            throw error;
          }
        }

        if (!workspace) {
          send({ type: "error", data: { message: "Failed to create workspace" } });
          controller.close();
          return;
        }

        const workspaceId = workspace.id;
        send({ type: "workspace", data: { id: workspace.id, slug: workspace.slug || "", name: workspace.name } });

        // Create WORKSPACE_CREATED event
        try {
          await db.execute(sql`
            SELECT append_workspace_event(
              ${workspaceId}::uuid,
              ${randomUUID()}::text,
              ${"WORKSPACE_CREATED"}::text,
              ${JSON.stringify({ title, description: "" })}::jsonb,
              ${Date.now()}::bigint,
              ${userId}::text,
              0::integer,
              ${user.name || user.email || null}::text
            )
          `);
        } catch (eventError) {
          console.error("Error creating WORKSPACE_CREATED event:", eventError);
        }

        // 3. Generate content in parallel. Note + flashcard share one Gemini call; quiz and youtube are separate.
        const noteAndFlashcardFn = async () => {
          const { output } = await generateText({
            model: google("gemini-2.5-flash-lite"),
            system: NOTE_FLASHCARD_SYSTEM,
            output: Output.object({
              name: "NoteAndFlashcards",
              description: "Study note and flashcard deck for the same topic",
              schema: z.object({
                note: z.object({
                  title: z.string(),
                  content: z.string(),
                }),
                flashcards: z.object({
                  title: z.string(),
                  cards: z.array(z.object({
                    front: z.string(),
                    back: z.string(),
                  })).min(5).max(12),
                }),
              }),
            }),
            prompt: `Create study materials about: "${prompt}".

Return:
1. note: a short title and markdown content for a study note.
2. flashcards: a title and 5-8 flashcard pairs (front, back) on the same topic.`,
          });

          await workspaceWorker("create", {
            workspaceId,
            title: output.note.title,
            content: output.note.content,
            itemType: "note",
            layout: AUTOGEN_LAYOUTS.note,
          });
          send({ type: "progress", data: { step: "note", status: "done" } });

          await workspaceWorker("create", {
            workspaceId,
            title: output.flashcards.title,
            itemType: "flashcard",
            flashcardData: { cards: output.flashcards.cards },
            layout: AUTOGEN_LAYOUTS.flashcard,
          });
          send({ type: "progress", data: { step: "flashcards", status: "done" } });
        };

        const tasks: Array<{ step: "quiz" | "youtube"; fn: () => Promise<unknown> }> = [
          {
            step: "quiz",
            fn: async () => {
              const quiz = await quizWorker({ topic: prompt, questionCount: 5 });
              return workspaceWorker("create", {
                workspaceId,
                title: quiz.title,
                itemType: "quiz",
                quizData: { questions: quiz.questions },
                layout: AUTOGEN_LAYOUTS.quiz,
              });
            },
          },
          {
            step: "youtube",
            fn: async () => {
              const videos = await searchVideos(prompt, 3);
              const video = videos[0];
              if (!video) return { success: false, message: "No videos found" };
              return workspaceWorker("create", {
                workspaceId,
                title: video.title,
                itemType: "youtube",
                youtubeData: { url: video.url },
                layout: AUTOGEN_LAYOUTS.youtube,
              });
            },
          },
        ];

        // Run note+flashcard (one Gemini call) alongside quiz and youtube
        await Promise.all([
          noteAndFlashcardFn(),
          ...tasks.map(async ({ step, fn }) => {
            await fn();
            send({ type: "progress", data: { step, status: "done" } });
          }),
        ]);

        send({
          type: "complete",
          data: {
            workspace: {
              id: workspace.id,
              slug: workspace.slug || "",
              name: workspace.name,
            },
          },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        send({ type: "error", data: { message: msg } });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
