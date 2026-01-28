import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EventResponse } from "@/lib/workspace/events";
import type { WorkspaceEvent } from "@/lib/workspace/events";

interface ToolResult {
  success: boolean;
  itemId?: string;
  event?: WorkspaceEvent;
  version?: number;
}

/**
 * Apply an optimistic cache update when a tool completes (receipt phase).
 * Uses cache-as-source-of-truth, no refs or module state.
 *
 * Rules:
 * - Empty cache (e.g. hard refresh): skip. Let the normal fetch populate.
 * - Event already in cached.events (delta): skip.
 * - result.version <= cached.snapshot?.version: event is in snapshot, skip.
 * - Else: append event to cache.
 *
 * Durable across refresh (we never overwrite empty cache) and correct when
 * events are compressed into a snapshot.
 */
export function useOptimisticToolUpdate(
  status: { type: string } | undefined,
  result: ToolResult | undefined,
  workspaceId: string | null
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (
      status?.type !== "complete" ||
      !result?.success ||
      !result.event ||
      !workspaceId
    ) {
      return;
    }
    const eventId = result.event.id;
    if (!eventId) return;

    const cached = queryClient.getQueryData<EventResponse>([
      "workspace",
      workspaceId,
      "events",
    ]);

    if (!cached) return;
    if (!Array.isArray(cached.events)) return;

    const alreadyInDelta = cached.events.some((e) => e.id === eventId);
    if (alreadyInDelta) return;

    const snapshotVersion = cached.snapshot?.version;
    if (
      typeof snapshotVersion === "number" &&
      typeof result.version === "number" &&
      result.version <= snapshotVersion
    ) {
      return;
    }

    queryClient.setQueryData<EventResponse>(
      ["workspace", workspaceId, "events"],
      (old) => {
        if (!old) {
          return {
            events: [{ ...result.event!, version: result.version }],
            version: result.version ?? 0,
          };
        }
        return {
          ...old,
          events: [
            ...old.events,
            { ...result.event!, version: result.version ?? old.version },
          ],
          version: result.version ?? old.version,
        };
      }
    );
  }, [status, result, workspaceId, queryClient]);
}
