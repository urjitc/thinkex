/**
 * Shared utilities for AI tools
 */

import { loadWorkspaceState } from "@/lib/workspace/state-loader";
import type { Item } from "@/lib/workspace-state/types";
import type { WorkspaceToolContext } from "./workspace-tools";

/**
 * Load workspace state for tool operations
 * Security is enforced by workspace-worker, so we just load state here
 */
export async function loadStateForTool(
    ctx: WorkspaceToolContext
): Promise<{ success: true; state: { items: Item[] } } | { success: false; message: string }> {
    if (!ctx.workspaceId) {
        return { success: false, message: "No workspace context available" };
    }

    const state = await loadWorkspaceState(ctx.workspaceId);
    return { success: true, state };
}

/**
 * Fuzzy match an item by name within a list of items
 * Tries: exact match -> contains match -> reverse contains match
 */
export function fuzzyMatchItem(
    items: Item[],
    searchName: string,
    itemType: Item["type"]
): Item | undefined {
    const normalizedSearch = searchName.toLowerCase().trim();
    const filteredItems = items.filter(item => item.type === itemType);

    // 1. Exact match
    let matched = filteredItems.find(item => item.name.toLowerCase().trim() === normalizedSearch);
    
    // 2. Contains match (item name contains search)
    if (!matched) {
        matched = filteredItems.find(item => item.name.toLowerCase().includes(normalizedSearch));
    }
    
    // 3. Reverse contains match (search contains item name)
    if (!matched) {
        matched = filteredItems.find(item => normalizedSearch.includes(item.name.toLowerCase().trim()));
    }

    return matched;
}

/**
 * Get a formatted list of available items of a given type
 */
export function getAvailableItemsList(items: Item[], itemType: Item["type"]): string {
    const filtered = items.filter(item => item.type === itemType);
    if (filtered.length === 0) {
        return "";
    }
    return filtered.map(item => `"${item.name}"`).join(", ");
}
