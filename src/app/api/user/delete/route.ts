
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session || !session.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.user.id;

        // Delete the user
        // Drizzle schema should have cascade delete configured for related tables (sessions, accounts, workspaces etc)
        // If not, we might need to manually delete related records, but typically cascade handles it.
        // Checking schema.ts from earlier view_file, constraints like onDelete: "cascade" are present on session/account tables.

        await db.delete(user).where(eq(user.id, userId));

        return NextResponse.json({ success: true, message: "Account deleted successfully" });
    } catch (error: any) {
        console.error("Error deleting account:", error);
        return NextResponse.json(
            { error: "Failed to delete account", details: error.message },
            { status: 500 }
        );
    }
}
