/**
 * Quiz Tools
 * Tools for creating and updating quizzes in workspaces
 */

import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { quizWorker, workspaceWorker } from "@/lib/ai/workers";
import { loadWorkspaceState } from "@/lib/workspace/state-loader";
import type { WorkspaceToolContext } from "./workspace-tools";
import type { QuizData } from "@/lib/workspace-state/types";

/**
 * Extract content from selected cards context
 */
function extractSelectedCardsContext(text: string) {
    const marker = "[[SELECTED_CARDS_MARKER]]";
    const match = text.match(new RegExp(`${marker}([\\s\\S]*?)${marker}`));
    if (!match) return null;

    const rawContext = match[1];

    // Extract card names and IDs
    const nameMatches = rawContext.matchAll(/CARD\s+\d+:\s+.*"([^"]+)"/g);
    const idMatches = rawContext.matchAll(/Card ID:\s*([a-zA-Z0-9_-]+)/g);
    const names = Array.from(nameMatches).map(m => m[1]);
    const ids = Array.from(idMatches).map(m => m[1]);

    // Extract ONLY the actual content, not metadata
    const contentSections: string[] = [];
    const cardBlocks = rawContext.split(/━+/);

    for (const block of cardBlocks) {
        const contentMatch = block.match(/📄 CONTENT:\s*([\s\S]*?)(?=🔧 METADATA:|$)/);
        if (contentMatch && contentMatch[1]) {
            let content = contentMatch[1].trim();
            content = content.replace(/^\s*-\s*Content:\s*/i, '');
            content = content.replace(/^\s{2,}/gm, '');
            if (content && content.length > 10) {
                const cardNameMatch = block.match(/CARD\s+\d+:\s+[^\[]*\[([^\]]+)\]\s+"([^"]+)"/);
                if (cardNameMatch) {
                    contentSections.push(`## ${cardNameMatch[2]}\n${content}`);
                } else {
                    contentSections.push(content);
                }
            }
        }
    }

    let cleanedContext = contentSections.length > 0
        ? contentSections.join('\n\n')
        : rawContext
            .replace(/CARD\s+\d+:.*$/gm, '')
            .replace(/⚡ Card ID:.*$/gm, '')
            .replace(/🔧 METADATA:[\s\S]*?(?=CARD|$)/g, '')
            .replace(/📄 CONTENT:/g, '')
            .replace(/━+/g, '')
            .replace(/Card ID:\s*[a-zA-Z0-9_-]+/g, '')
            .replace(/Type:\s*\w+/g, '')
            .trim();

    return { context: cleanedContext, names, ids };
}

/**
 * Create the createQuiz tool
 */
export function createQuizTool(ctx: WorkspaceToolContext, convertedMessages: any[]) {
    return {
        description: "Create an interactive quiz in the workspace. Generates multiple-choice and true/false questions. If cards are selected in the context drawer, questions are generated EXCLUSIVELY from that content. If no context is selected, generates questions from general knowledge about the provided topic. Creates a quiz card with 10 questions that the user can take interactively.",
        // Use z.any() to avoid streaming validation errors when Gemini sends properties in random order
        // The error "argsText can only be appended" happens because strict z.object() validates during streaming
        inputSchema: z.any().describe("Object with optional 'topic' (string) and 'difficulty' ('easy'|'medium'|'hard', default 'medium')"),
        execute: async (args: unknown) => {
            // Manually extract and validate args since we're using z.any()
            const parsedArgs = args as { topic?: string; difficulty?: string } | null;
            const topic = parsedArgs?.topic;
            const difficulty = (parsedArgs?.difficulty as "easy" | "medium" | "hard") || "medium";
            logger.debug("🎯 [CREATE-QUIZ] Tool execution started:", { topic, difficulty });

            if (!ctx.workspaceId) {
                return {
                    success: false,
                    message: "No workspace context available",
                };
            }

            try {
                // Check if we have context from selected cards
                let contextContent: string | undefined;
                let sourceCardIds: string[] | undefined;
                let sourceCardNames: string[] | undefined;

                for (const msg of convertedMessages) {
                    if (typeof msg.content === "string") {
                        const extracted = extractSelectedCardsContext(msg.content);
                        if (extracted && extracted.context) {
                            contextContent = extracted.context;
                            sourceCardNames = extracted.names;
                            sourceCardIds = extracted.ids;
                            break;
                        }
                    } else if (Array.isArray(msg.content)) {
                        for (const part of msg.content) {
                            if (part.type === "text" && typeof part.text === "string") {
                                const extracted = extractSelectedCardsContext(part.text);
                                if (extracted && extracted.context) {
                                    contextContent = extracted.context;
                                    sourceCardNames = extracted.names;
                                    sourceCardIds = extracted.ids;
                                    break;
                                }
                            }
                        }
                        if (contextContent) break;
                    }
                }

                logger.debug("🎯 [CREATE-QUIZ] Context extracted:", {
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
                    difficulty,
                    questionCount: 10,
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
                        difficulty,
                        sourceCardIds,
                    },
                    folderId: ctx.activeFolderId,
                });

                return {
                    success: true,
                    quizId: workerResult.itemId,
                    title: quizResult.title,
                    questionCount: quizResult.questions.length,
                    difficulty,
                    isContextBased: !!contextContent,
                    message: `Created quiz "${quizResult.title}" with ${quizResult.questions.length} questions.`,
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
        description: "Add more questions to an existing quiz. This tool analyzes the user's performance history (weak areas) to generate targeted follow-up questions. It should be called when the user asks to 'continue the quiz', 'add more questions', or 'practice my weak areas'.",
        inputSchema: z.object({
            quizId: z.string().describe("ID of the quiz to update"),
        }),
        execute: async ({ quizId }: { quizId: string }) => {
            logger.debug("🎯 [UPDATE-QUIZ] Tool execution started:", { quizId });

            if (!ctx.workspaceId) {
                return {
                    success: false,
                    message: "No workspace context available",
                };
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

                // Generate new questions
                const quizResult = await quizWorker({
                    topic: quizItem.name,
                    contextContent: currentQuizData.sourceCardIds?.length
                        ? `Continue quiz about: ${quizItem.name}`
                        : undefined,
                    difficulty: currentQuizData.difficulty || "medium",
                    questionCount: 10,
                    existingQuestions,
                    performanceTelemetry,
                    sourceCardIds: currentQuizData.sourceCardIds,
                });

                // Update the quiz with new questions
                // Cast to any since workspaceWorker internal types use questionsToAdd
                const workerResult = await workspaceWorker("updateQuiz", {
                    workspaceId: ctx.workspaceId,
                    itemId: quizId,
                    itemType: "quiz",
                    quizData: {
                        questionsToAdd: quizResult.questions,
                    } as any,
                });

                return {
                    success: true,
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
