/**
 * Frequent Collaborators API
 * 
 * GET /api/collaborators/frequent - Get list of users the current user has frequently collaborated with
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { workspaceCollaborators, workspaces, user } from "@/lib/db/schema";
import { eq, and, sql, or } from "drizzle-orm";
import { requireAuth, withErrorHandling } from "@/lib/api/workspace-helpers";

// GET /api/collaborators/frequent
async function handleGET(request: NextRequest) {
    const userId = await requireAuth();

    // Find users that the current user has collaborated with
    // This includes:
    // 1. Users invited to workspaces owned by current user
    // 2. Users who are co-collaborators on workspaces where current user is a collaborator

    const frequentCollaborators = await db
        .select({
            userId: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            lastCollaboratedAt: sql<string>`MAX(${workspaceCollaborators.createdAt})`,
            collaborationCount: sql<number>`COUNT(DISTINCT ${workspaceCollaborators.workspaceId})`,
        })
        .from(workspaceCollaborators)
        .innerJoin(user, eq(workspaceCollaborators.userId, user.id))
        .innerJoin(workspaces, eq(workspaceCollaborators.workspaceId, workspaces.id))
        .where(
            and(
                // Don't include the current user themselves
                sql`${workspaceCollaborators.userId} != ${userId}`,
                // Only include collaborators from:
                or(
                    // 1. Workspaces owned by the current user (users I've invited)
                    eq(workspaces.userId, userId),
                    // 2. Workspaces where current user is also a collaborator (co-collaborators)
                    sql`EXISTS (
                        SELECT 1 FROM ${workspaceCollaborators} wc2
                        WHERE wc2.workspace_id = ${workspaceCollaborators.workspaceId}
                        AND wc2.user_id = ${userId}
                    )`
                )
            )
        )
        .groupBy(user.id, user.name, user.email, user.image)
        .orderBy(sql`MAX(${workspaceCollaborators.createdAt}) DESC`)
        .limit(6);

    return NextResponse.json({
        collaborators: frequentCollaborators.map(c => ({
            userId: c.userId,
            name: c.name,
            email: c.email,
            image: c.image,
            lastCollaboratedAt: c.lastCollaboratedAt,
            collaborationCount: Number(c.collaborationCount),
        }))
    });
}

export const GET = withErrorHandling(handleGET, "GET /api/collaborators/frequent");
