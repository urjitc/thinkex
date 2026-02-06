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
                // Process multiple URLs in parallel using separate generateText calls
                const urlProcessingPromises = urlList.map(async (url: string) => {
                    const promptText = `Analyze the content from the following URL:
${url}

Please provide:
- What this URL/page is about
- Key information, features, specifications, or data
- Important details relevant to the user's question
- Publication dates or last updated information

Provide a clear, accurate answer based on the URL content.`;

                    // Helper to run the analysis on simple text content
                    // Used for fallback when the main tool fails
                    const analyzeTextContent = async (textInfo: string, isFallback = false) => {
                        const { text } = await generateText({
                            model: google("gemini-2.5-flash"),
                            prompt: isFallback
                                ? `Analyze the following extracted text from ${url}:\n\n${textInfo}\n\n${promptText}`
                                : promptText,
                        });
                        return text;
                    };

                    try {
                        // PRIMARY ATTEMPT: Google URL Context Tool
                        const tools: any = {
                            url_context: google.tools.urlContext({}),
                        };

                        const { text, sources, providerMetadata } = await generateText({
                            model: google("gemini-2.5-flash"),
                            tools,
                            prompt: promptText,
                        });

                        const urlMetadata = providerMetadata?.urlContext?.urlMetadata || null;
                        const groundingChunks = providerMetadata?.urlContext?.groundingChunks || null;

                        // Check for refusal/failure in the generated text
                        const isRefusal = text.includes("unable to access") ||
                            text.includes("cannot access the content") ||
                            text.includes("I cannot provide an analysis");

                        // Check if we actually retrieved anything
                        const hasSuccessfulRetrieval = Array.isArray(urlMetadata) &&
                            urlMetadata.some((m: any) => m.urlRetrievalStatus === "SUCCESS" || !m.urlRetrievalStatus);

                        // If the model refused and we didn't get successful retrieval metadata, treat as failure
                        if (isRefusal && !hasSuccessfulRetrieval) {
                            throw new Error("Model refused or failed to access content (soft failure detected)");
                        }

                        return {
                            url,
                            success: true,
                            text,
                            metadata: {
                                urlMetadata: Array.isArray(urlMetadata) ? (urlMetadata as Array<{ retrievedUrl: string; urlRetrievalStatus: string }>) : null,
                                groundingChunks: Array.isArray(groundingChunks) ? (groundingChunks as Array<any>) : null,
                                sources: Array.isArray(sources) ? (sources as Array<any>) : null,
                            },
                        };
                    } catch (urlError) {
                        const errorMessage = urlError instanceof Error ? urlError.message : String(urlError);
                        logger.warn(`⚠️ [URL_TOOL] Primary method failed for ${url}, attempting fallback. Error: ${errorMessage}`);

                        // FALLBACK ATTEMPT: Manual Fetch + Cheerio
                        try {
                            const extractedText = await extractTextFromUrl(url);
                            const analysis = await analyzeTextContent(extractedText, true);

                            return {
                                url,
                                success: true,
                                text: analysis + "\n\n*(Note: Content accessed via fallback method due to site restrictions)*",
                                metadata: {
                                    urlMetadata: null, // Metadata not available in fallback
                                    groundingChunks: null,
                                    sources: [{ uri: url, title: "Extracted Content" }],
                                },
                            };
                        } catch (fallbackError) {
                            logger.error(`❌ [URL_TOOL] Fallback also failed for ${url}:`, fallbackError);

                            return {
                                url,
                                success: false,
                                text: `Error processing ${url} (Standard & Fallback failed): ${errorMessage}`,
                                metadata: {
                                    urlMetadata: null,
                                    groundingChunks: null,
                                    sources: null,
                                },
                            };
                        }
                    }
                });

                // Execute all URL processing in parallel
                const results = await Promise.all(urlProcessingPromises);

                // Aggregate results
                const successfulResults = results.filter(r => r.success);
                const failedResults = results.filter(r => !r.success);

                // Combine text from all successful results
                const combinedText = results
                    .map(r => `**${r.url}**\n\n${r.text}`)
                    .join('\n\n---\n\n');

                // Combine metadata from all results
                const allUrlMetadata = results
                    .flatMap(r => r.metadata.urlMetadata || [])
                    .filter((m): m is { retrievedUrl: string; urlRetrievalStatus: string } => m !== null);
                const allGroundingChunks = results
                    .flatMap(r => r.metadata.groundingChunks || [])
                    .filter((c): c is any => c !== null);
                const allSources = results
                    .flatMap(r => r.metadata.sources || [])
                    .filter((s): s is any => s !== null);

                if (failedResults.length > 0) {
                    logger.warn(`🔗 [URL_TOOL] ${failedResults.length} URL(s) failed to process:`, failedResults.map(r => r.url));
                }

                return {
                    text: combinedText,
                    metadata: {
                        urlMetadata: allUrlMetadata.length > 0 ? allUrlMetadata : null,
                        groundingChunks: allGroundingChunks.length > 0 ? allGroundingChunks : null,
                        sources: allSources.length > 0 ? allSources : null,
                    },
                };
            } catch (error) {
                logger.error("🔗 [URL_TOOL] Error processing web URLs:", {
                    error: error instanceof Error ? error.message : String(error),
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                    errorStack: error instanceof Error ? error.stack : undefined,
                    urls: urlList,
                    fullError: error,
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
