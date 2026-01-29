import { GoogleGenAI } from "@google/genai";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import { randomUUID } from "crypto";
import { logger } from "@/lib/utils/logger";
import { workspaceWorker } from "@/lib/ai/workers";
import type { WorkspaceToolContext } from "./workspace-tools";
import {
    reserveDeepResearchUsage,
    completeDeepResearchUsage,
    failDeepResearchUsage
} from "@/lib/services/rate-limit";

/**
 * Format reset time for user-friendly display
 */
function formatResetTime(resetAt: Date | null): string {
    if (!resetAt) return "24 hours";
    const diffMs = Math.max(0, resetAt.getTime() - Date.now());
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes} minutes`;
}

/**
 * Create the deepResearch tool
 */
export function createDeepResearchTool(ctx: WorkspaceToolContext) {
    return tool({
        description: "Perform deep, multi-step research on a complex topic. Use this when the user explicitly asks for 'deep research' or when a simple web search is insufficient for the depth required. This tool IMMEDIATELY creates a special research card in the workspace that will stream progress and display the final report. You should ask clarifying questions BEFORE calling this tool if the request is vague. Once ready, call this tool with the refined topic/prompt.",
        inputSchema: zodSchema(
            z.object({
                prompt: z.string().describe("The detailed research topic and instructions."),
            })
        ),
        execute: async ({ prompt }) => {
            logger.debug("🎯 [DEEP-RESEARCH] Starting deep research for:", prompt);

            // Generate idempotency key for this request
            const requestId = randomUUID();
            let usageId: string | null = null;

            try {
                // Auth check
                if (!ctx.userId) {
                    return { error: "Authentication required for deep research" };
                }

                // Anonymous user check
                if (ctx.isAnonymous) {
                    return {
                        rateLimited: true,
                        userMessage: "Deep research requires a registered account. Please sign up to use this feature.",
                    };
                }

                // Validate prerequisites before rate limit check
                const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
                if (!apiKey) {
                    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
                }

                if (!ctx.workspaceId) {
                    throw new Error("No workspace context available");
                }

                // Reserve a usage slot atomically (works with connection pooling)
                const rateLimit = await reserveDeepResearchUsage(
                    ctx.userId,
                    ctx.workspaceId,
                    requestId
                );

                if (!rateLimit.allowed) {
                    const timeStr = formatResetTime(rateLimit.resetAt);
                    return {
                        rateLimited: true,
                        resetAt: rateLimit.resetAt?.toISOString(),
                        userMessage: rateLimit.error || `You've reached your daily deep research limit (2 per 24 hours). Available again in ${timeStr}.`,
                    };
                }

                // Store usageId for completion/failure tracking
                usageId = rateLimit.usageId;

                // Log if this was a duplicate request (idempotency)
                if (rateLimit.wasDuplicate) {
                    logger.info("🔄 [DEEP-RESEARCH] Duplicate request detected, reusing reservation:", requestId);
                }

                const client = new GoogleGenAI({
                    apiKey: apiKey,
                });

                // Start the deep research interaction in background mode with thinking enabled
                const interaction = await client.interactions.create({
                    input: prompt,
                    agent: "deep-research-pro-preview-12-2025",
                    background: true,
                    agent_config: {
                        type: 'deep-research',
                        thinking_summaries: 'auto'
                    }
                });

                logger.debug("🎯 [DEEP-RESEARCH] Interaction started:", interaction.id);

                // Create a note with deep research metadata immediately
                const noteResult = await workspaceWorker("create", {
                    workspaceId: ctx.workspaceId,
                    title: `Research: ${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}`,
                    deepResearchData: {
                        prompt,
                        interactionId: interaction.id,
                    },
                    folderId: ctx.activeFolderId,
                });

                logger.debug("🎯 [DEEP-RESEARCH] Research note created:", noteResult.itemId);

                // Complete the usage reservation with real interactionId
                if (usageId) {
                    const completed = await completeDeepResearchUsage(usageId, interaction.id);
                    if (!completed) {
                        logger.warn("⚠️ [DEEP-RESEARCH] Failed to update usage record with interactionId");
                    }
                }

                return {
                    noteId: noteResult.itemId,
                    interactionId: interaction.id,
                    message: "Deep research started. Check the new research card in your workspace to see progress.",
                };
            } catch (error: unknown) {
                logger.error("❌ [DEEP-RESEARCH] Error:", error);

                // Rollback the reservation if we had one
                if (usageId) {
                    logger.debug("🔄 [DEEP-RESEARCH] Rolling back usage reservation due to error");
                    await failDeepResearchUsage(usageId);
                }

                const errorMessage = error instanceof Error ? error.message : "Failed to start deep research";
                return {
                    error: errorMessage
                };
            }
        },
    });
}
