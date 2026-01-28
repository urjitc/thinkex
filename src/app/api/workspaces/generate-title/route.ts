import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { requireAuth, withErrorHandling } from "@/lib/api/workspace-helpers";

const MAX_TITLE_LENGTH = 60;

/**
 * POST /api/workspaces/generate-title
 * Generate a concise workspace title from a user prompt (e.g. for create-from-prompt flow).
 */
async function handlePOST(request: NextRequest) {
  await requireAuth();

  const body = await request.json();
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return NextResponse.json(
      { error: "prompt is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: `Generate a short, concise workspace title (max 5–6 words) for the given topic or prompt. Return ONLY the title, no quotes or explanation.`,
    prompt: `Topic/prompt: ${prompt}`,
  });

  let title = text.trim();
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.substring(0, MAX_TITLE_LENGTH).trim();
  }
  if (!title) {
    title = "New Workspace";
  }

  return NextResponse.json({ title });
}

export const POST = withErrorHandling(handlePOST, "POST /api/workspaces/generate-title");
