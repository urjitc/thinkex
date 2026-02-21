/**
 * Read-before-write tracking for workspace items (FileTime pattern).
 * Records when a thread reads an item; asserts before targeted edits.
 */

import { db, workspaceItemReads } from "@/lib/db/client";
import { eq, and } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";

/**
 * Record that a thread has read an item at the given lastModified.
 * Upserts: if thread+item exists, updates lastModified and readAt.
 */
export async function recordWorkspaceItemRead(
  threadId: string,
  itemId: string,
  lastModified: number
): Promise<void> {
  logger.debug("[workspace_item_reads] Writing to DB:", {
    threadId,
    itemId,
    lastModified,
    op: "upsert",
  });
  await db
    .insert(workspaceItemReads)
    .values({
      threadId,
      itemId,
      lastModified,
    })
    .onConflictDoUpdate({
      target: [workspaceItemReads.threadId, workspaceItemReads.itemId],
      set: {
        lastModified,
        readAt: new Date().toISOString(),
      },
    });
}

/**
 * Assert that the thread has read the item and the lastModified matches.
 * Used before targeted edits (oldString !== '').
 * @returns true if assertion passes
 * @throws never - returns an error object on failure
 */
export async function assertWorkspaceItemRead(
  threadId: string,
  itemId: string,
  currentLastModified: number
): Promise<{ ok: true } | { ok: false; message: string }> {
  const [row] = await db
    .select()
    .from(workspaceItemReads)
    .where(
      and(
        eq(workspaceItemReads.threadId, threadId),
        eq(workspaceItemReads.itemId, itemId)
      )
    )
    .limit(1);

  if (!row) {
    return {
      ok: false,
      message:
        "Read required before targeted edit. Use readWorkspace to read the note first, then retry updateNote with exact text from the content.",
    };
  }

  if (row.lastModified !== currentLastModified) {
    return {
      ok: false,
      message: `Note was modified since last read. Please use readWorkspace to get the latest content, then retry the edit.`,
    };
  }

  return { ok: true };
}
