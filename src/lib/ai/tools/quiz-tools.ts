/**
 * Quiz Tools
 * Tools for creating and updating quizzes in workspaces
 */

import { z } from "zod";
import { zodSchema } from "ai";
import { logger } from "@/lib/utils/logger";
import { quizWorker, workspaceWorker } from "@/lib/ai/workers";
import { loadWorkspaceState } from "@/lib/workspace/state-loader";
import type { WorkspaceToolContext } from "./workspace-tools";
import type { QuizData } from "@/lib/workspace-state/types";

/**
 * Create the createQuiz tool
 */
export function createQuizTool(ctx: WorkspaceToolContext) {
    return {
        description: "Create an interactive quiz. Extract topic from user message. Use selected cards as context if available.",
        // Simplified schema to be more robust during streaming
        // Avoid complex nullable types that can cause parsing issues during streaming
        inputSchema: zodSchema(
            z.object({
                topic: z.string().describe("The topic for the quiz - REQUIRED: extract from user's message"),
                contextContent: z.string().optional().describe("Content from selected cards in system context if available"),
                sourceCardIds: z.array(z.string()).optional().describe("IDs of source cards"),
                sourceCardNames: z.array(z.string()).optional().describe("Names of source cards"),
            })
        ),
        execute: async (args: unknown) => {
            // Validate args using simplified schema to be more robust during streaming
            const createQuizSchema = z.object({
                topic: z.string().optional(),
                contextContent: z.string().optional(),
                sourceCardIds: z.array(z.string()).optional(),
                sourceCardNames: z.array(z.string()).optional(),
            });

            const parsedArgs = createQuizSchema.parse(args);
            const topic = parsedArgs.topic;
            const contextContent = parsedArgs.contextContent;
            const sourceCardIds = parsedArgs.sourceCardIds;
            const sourceCardNames = parsedArgs.sourceCardNames;
            logger.debug("🎯 [CREATE-QUIZ] Tool execution started:", { topic, hasContext: !!contextContent });

            if (!ctx.workspaceId) {
                return {
                    success: false,
                    message: "No workspace context available",
                };
            }

            if (!topic && !contextContent) {
                return {
                    success: false,
                    message: "Either 'topic' or 'contextContent' must be provided",
                };
            }

            try {

                logger.debug("🎯 [CREATE-QUIZ] Context provided:", {
                    hasContext: !!contextContent,
                    contextLength: contextContent?.length,
                    sourceCardNames,
                    sourceCardIds,
                    providedTopic: topic,
                });

                // Generate quiz using quizWorker
                const quizResult = await quizWorker({
                    topic: topic || undefined,
                    contextContent,
                    questionCount: 5,
                    sourceCardIds,
                    sourceCardNames,
                });

                logger.debug("🎯 [CREATE-QUIZ] quizWorker returned:", {
                    title: quizResult.title,
                    questionCount: quizResult.questions?.length,
                });

                // Create quiz item in workspace
                const workerResult = await workspaceWorker("create", {
                    workspaceId: ctx.workspaceId,
                    title: quizResult.title,
                    itemType: "quiz",
                    quizData: {
                        questions: quizResult.questions,
                        sourceCardIds,
                        sourceCardNames,
                    },
                    folderId: ctx.activeFolderId,
                });

                if (!workerResult.success) {
                    return workerResult;
                }

                return {
                    success: true,
                    itemId: workerResult.itemId,
                    quizId: workerResult.itemId,
                    title: quizResult.title,
                    questionCount: quizResult.questions.length,
                    isContextBased: !!contextContent,
                    message: `Created quiz "${quizResult.title}" with ${quizResult.questions.length} questions.`,
                    event: workerResult.event,
                    version: workerResult.version,
                };
            } catch (error) {
                logger.error("❌ [CREATE-QUIZ] Error:", error);
                return {
                    success: false,
                    message: `Error creating quiz: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}

/**
 * Create the updateQuiz tool
 */
export function createUpdateQuizTool(ctx: WorkspaceToolContext) {
    return {
        description: "Update quiz title and/or add more questions. Can use new topic, selected cards, or general knowledge.",
        // Simplified schema to be more robust during streaming
        // Avoid complex nullable types that can cause parsing issues during streaming
        inputSchema: zodSchema(
            z.object({
                quizId: z.string().describe("The ID of the quiz to update"),
                title: z.string().optional().describe("New title for the quiz. If not provided, the existing title will be preserved."),
                topic: z.string().optional().describe("New topic for questions"),
                contextContent: z.string().optional().describe("Content from newly selected cards in system context"),
                sourceCardIds: z.array(z.string()).optional().describe("IDs of source cards"),
                sourceCardNames: z.array(z.string()).optional().describe("Names of source cards"),
            })
        ),
        execute: async (args: unknown) => {
            // Validate args using simplified schema to be more robust during streaming
            const updateQuizSchema = z.object({
                quizId: z.string(),
                title: z.string().optional(),
                topic: z.string().optional(),
                contextContent: z.string().optional(),
                sourceCardIds: z.array(z.string()).optional(),
                sourceCardNames: z.array(z.string()).optional(),
            });

            const parsedArgs = updateQuizSchema.parse(args);
            const quizId = parsedArgs.quizId;
            const title = parsedArgs.title;
            const explicitTopic = parsedArgs.topic;

            logger.debug("🎯 [UPDATE-QUIZ] Tool execution started:", { quizId, explicitTopic, title });

            if (!ctx.workspaceId) {
                return {
                    success: false,
                    message: "No workspace context available",
                };
            }

            // Validate required quizId
            if (!quizId) {
                return {
                    success: false,
                    message: "Quiz ID is required. Please select a quiz card to update.",
                };
            }

            // Handle title update separately if provided
            if (title) {
                try {
                    const titleUpdateResult = await workspaceWorker("update", {
                        workspaceId: ctx.workspaceId,
                        itemId: quizId,
                        title: title,
                    });

                    if (!titleUpdateResult.success) {
                        return titleUpdateResult;
                    }

                    logger.debug("🎯 [UPDATE-QUIZ] Title updated successfully:", { newTitle: title });
                } catch (error) {
                    logger.error("❌ [UPDATE-QUIZ] Error updating title:", error);
                    return {
                        success: false,
                        message: `Error updating quiz title: ${error instanceof Error ? error.message : String(error)}`,
                    };
                }
            }

            try {
                // Load current workspace state to find the quiz
                const state = await loadWorkspaceState(ctx.workspaceId);
                const quizItem = state.items.find(item => item.id === quizId);

                if (!quizItem || quizItem.type !== 'quiz') {
                    logger.warn("❌ [UPDATE-QUIZ] Quiz not found:", {
                        searchedId: quizId,
                        availableIds: state.items.filter(i => i.type === 'quiz').map(i => i.id)
                    });
                    return {
                        success: false,
                        message: "Quiz not found. Please select a quiz card in the context drawer.",
                    };
                }

                const currentQuizData = quizItem.data as QuizData;
                const existingQuestions = currentQuizData.questions || [];
                const session = currentQuizData.session;

                logger.debug("✅ [UPDATE-QUIZ] Found quiz:", {
                    id: quizItem.id,
                    name: quizItem.name,
                    questionCount: existingQuestions.length,
                    hasSession: !!session,
                    answeredCount: session?.answeredQuestions?.length,
                });

                // Build performance telemetry from answered questions
                let performanceTelemetry;
                if (session?.answeredQuestions && session.answeredQuestions.length > 0) {
                    const weakAreas = session.answeredQuestions
                        .filter(a => !a.isCorrect)
                        .map(a => {
                            const question = existingQuestions.find(q => q.id === a.questionId);
                            return question ? {
                                questionId: a.questionId,
                                questionText: question.questionText,
                                userSelectedOption: question.options?.[a.userAnswer] || "Unknown",
                                correctOption: question.options?.[question.correctIndex] || "Unknown",
                            } : null;
                        })
                        .filter((x): x is NonNullable<typeof x> => x !== null);

                    const correctCount = session.answeredQuestions.filter(a => a.isCorrect).length;
                    performanceTelemetry = {
                        correctCount,
                        incorrectCount: session.answeredQuestions.length - correctCount,
                        totalAnswered: session.answeredQuestions.length,
                        weakAreas,
                    };
                }

                // Use context/topic provided by LLM, or default to quiz name for continuation
                const contextContent = parsedArgs?.contextContent;
                const sourceCardIds = parsedArgs?.sourceCardIds;
                const sourceCardNames = parsedArgs?.sourceCardNames;
                const topic = explicitTopic || quizItem.name;

                logger.debug("🎯 [UPDATE-QUIZ] Configuration:", {
                    topic,
                    hasContext: !!contextContent,
                    sourceCards: sourceCardNames
                });

                // If only title was provided (no topic/context), return success
                if (!explicitTopic && !contextContent && !sourceCardIds) {
                    return {
                        success: true,
                        quizId,
                        message: title ? `Updated quiz title to "${title}".` : "Quiz updated successfully.",
                    };
                }

                // Generate new questions
                const quizResult = await quizWorker({
                    topic,
                    contextContent,
                    questionCount: 5,
                    existingQuestions,
                    performanceTelemetry,
                    sourceCardIds,
                    sourceCardNames
                });

                // Update the quiz with new questions
                const workerResult = await workspaceWorker("updateQuiz", {
                    workspaceId: ctx.workspaceId,
                    itemId: quizId,
                    itemType: "quiz",
                    questionsToAdd: quizResult.questions,
                });

                if (!workerResult.success) {
                    return workerResult;
                }

                return {
                    ...workerResult,
                    quizId,
                    questionsAdded: quizResult.questions.length,
                    totalQuestions: existingQuestions.length + quizResult.questions.length,
                    message: `Added ${quizResult.questions.length} new questions to the quiz.`,
                };
            } catch (error) {
                logger.error("❌ [UPDATE-QUIZ] Error:", error);
                return {
                    success: false,
                    message: `Error updating quiz: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        },
    };
}
