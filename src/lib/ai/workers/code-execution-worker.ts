import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { logger } from "@/lib/utils/logger";

/**
 * WORKER 2: Code Execution Agent
 * Executes Python code for calculations and data processing
 */
export async function codeExecutionWorker(task: string): Promise<string> {
    try {
        logger.debug("⚙️ [CODE-WORKER] Starting code execution for:", task);

        const result = await generateText({
            model: google("gemini-2.5-flash"),
            tools: {
                code_execution: google.tools.codeExecution({}),
            },
            prompt: `${task}

Use Python code execution to solve this problem. Show your work and explain the result.`,
        });

        logger.debug("⚙️ [CODE-WORKER] Code execution completed");
        return result.text;
    } catch (error) {
        logger.error("⚙️ [CODE-WORKER] Error:", error);
        throw error;
    }
}

