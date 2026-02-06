import { google } from "@ai-sdk/google";
import { generateText, tool, zodSchema } from "ai";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

/**
 * Create the processUrls tool for analyzing web pages
 */
// Helper to extract text from HTML using Cheerio
async function extractTextFromUrl(url: string): Promise<string> {
    const { load } = await import("cheerio");

    // Use a browser-like User-Agent to bypass basic bot blockers
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    const $ = load(html);

    // Remove scripts, styles, and other non-content elements
    $('script').remove();
    $('style').remove();
    $('nav').remove();
    $('footer').remove();
    $('iframe').remove();
    $('noscript').remove();

    // specific cleanup for documentation sites often helps
    $('.navigation').remove();
    $('.sidebar').remove();

    // Extract text from body
    // collapsing whitespace to single spaces
    const text = $('body').text().replace(/\s+/g, ' ').trim();

    // If body text is too short, it might be a JS-only site or failed extraction
    if (text.length < 50) {
        throw new Error("Extracted text is too short, possibly a JavaScript-required site");
    }

    return text.substring(0, 20000); // Limit context window usage
}

/**
 * Create the processUrls tool for analyzing web pages
 */
export function createProcessUrlsTool() {
    return tool({
        description: "Analyze web pages using Google's URL Context API. Extracts content, key information, and metadata from regular web URLs (http/https). Use this for web pages, articles, documentation, and other web content. For files (PDFs, images, documents) or videos, use the processFiles tool instead.",
        inputSchema: zodSchema(
            z.object({
                jsonInput: z.string().describe("JSON string containing an object with 'urls' (array of web URLs). Example: '{\"urls\": [\"https://example.com\"]}'"),
            })
        ),
        execute: async ({ jsonInput }) => {
            let parsed;
            try {
                parsed = JSON.parse(jsonInput);
            } catch (e) {
                logger.error("❌ [URL_TOOL] Failed to parse JSON input:", e);
                return "Error: Input must be a valid JSON string.";
            }

            // Validate parsed JSON shape
            if (typeof parsed !== 'object' || parsed === null) {
                return "Error: Input must be a JSON object with 'urls' array.";
            }

            const urlList = parsed.urls;

            if (!Array.isArray(urlList)) {
                return "Error: 'urls' must be an array.";
            }

            // Validate all items are strings
            if (!urlList.every((url: unknown) => typeof url === 'string')) {
                return "Error: All URLs must be strings.";
            }

            logger.debug("🔗 [URL_TOOL] Processing web URLs:", urlList);

            if (urlList.length === 0) {
                return "No URLs provided";
            }

            if (urlList.length > 20) {
                return `Too many URLs (${urlList.length}). Maximum 20 URLs allowed.`;
            }

            const fileUrls = urlList.filter((url: string) =>
                url.includes('supabase.co/storage') ||
                url.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/)
            );

            if (fileUrls.length > 0) {
                logger.warn("🔗 [URL_TOOL] File/video URLs detected, suggesting processFiles tool:", fileUrls);
                return `Error: This tool only handles web URLs. Please use the processFiles tool for file URLs (${fileUrls.join(', ')})`;
            }

            try {
                // Dynamically import UrlProcessor to avoid circular dependencies if any
                const { UrlProcessor } = await import("@/lib/ai/utils/url-processor");

                // Process URLs using the shared utility (handles fallback logic)
                const processingResults = await UrlProcessor.processUrls(urlList);

                // Filter successful results
                const successfulResults = processingResults.filter(r => r.success);
                const failedResults = processingResults.filter(r => !r.success);

                if (failedResults.length > 0) {
                    logger.warn(`🔗 [URL_TOOL] ${failedResults.length} URL(s) failed to process:`, failedResults.map(r => r.url));
                }

                if (successfulResults.length === 0) {
                    return {
                        text: `Failed to process any of the provided URLs. Errors: ${failedResults.map(r => `${r.url}: ${r.error}`).join('; ')}`,
                        metadata: { urlMetadata: null, groundingChunks: null, sources: null }
                    };
                }

                // Analyze each result with the LLM
                const analysisPromises = successfulResults.map(async (result) => {
                    const promptText = `Analyze the content from the following URL:
${result.url}

Content:
${result.content}

Please provide:
- What this URL/page is about
- Key information, features, specifications, or data
- Important details relevant to the user's question
- Publication dates or last updated information

Provide a clear, accurate answer based on the URL content.`;

                    const { text } = await generateText({
                        model: google("gemini-2.5-flash"),
                        prompt: promptText,
                    });

                    return {
                        url: result.url,
                        title: result.title,
                        text: text,
                        source: result.url
                    };
                });

                const analyses = await Promise.all(analysisPromises);

                // Combine text from all analyses
                const combinedText = analyses
                    .map(a => `**${a.title}** (${a.url})\n\n${a.text}`)
                    .join('\n\n---\n\n');

                if (failedResults.length > 0) {
                    const failureText = `\n\n*(Note: Failed to access ${failedResults.length} URLs: ${failedResults.map(r => r.url).join(', ')})*`;
                    return {
                        text: combinedText + failureText,
                        metadata: {
                            urlMetadata: null,
                            groundingChunks: null,
                            sources: analyses.map(a => ({ uri: a.url, title: a.title }))
                        }
                    };
                }

                return {
                    text: combinedText,
                    metadata: {
                        urlMetadata: null,
                        groundingChunks: null,
                        sources: analyses.map(a => ({ uri: a.url, title: a.title }))
                    },
                };

            } catch (error) {
                logger.error("🔗 [URL_TOOL] Error processing web URLs:", {
                    error: error instanceof Error ? error.message : String(error),
                    urls: urlList,
                });
                return {
                    text: `Error processing web URLs: ${error instanceof Error ? error.message : String(error)}`,
                    metadata: {
                        urlMetadata: null,
                        groundingChunks: null,
                        sources: null,
                    },
                };
            }
        },
    });
}
