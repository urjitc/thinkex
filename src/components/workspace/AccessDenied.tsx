"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Link from "next/link";

export function AccessDenied() {
    return (
        <div className="flex flex-1 w-full flex-col items-center justify-center gap-6 p-8 text-center animate-in fade-in duration-500">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>

            <div className="max-w-md space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                    Access Denied
                </h2>
                <p className="text-muted-foreground">
                    You don't have permission to view this workspace, or it doesn't exist.
                </p>
            </div>

            <div className="flex gap-4">
                <Button asChild variant="outline" size="lg" className="gap-2">
                    <Link href="/home">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
            </div>
        </div>
    );
}
