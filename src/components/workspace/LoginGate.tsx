"use client";

import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { signIn } from "@/lib/auth-client";

interface LoginGateProps {
    redirectPath?: string;
}

export function LoginGate({ redirectPath }: LoginGateProps) {
    const handleSignIn = async () => {
        // Redirect to the current path after sign in
        const callbackURL = redirectPath || window.location.pathname;
        await signIn.social({
            provider: "google",
            callbackURL,
        });
    };

    return (
        <div className="flex flex-1 w-full flex-col items-center justify-center gap-6 p-8 text-center animate-in fade-in duration-500">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50">
                <Lock className="h-10 w-10 text-muted-foreground" />
            </div>

            <div className="max-w-md space-y-2">
                <h2 className="text-2xl font-semibold tracking-tight">
                    Private Workspace
                </h2>
                <p className="text-muted-foreground">
                    This workspace is private. Please sign in to access it.
                </p>
            </div>

            <div className="flex gap-4">
                <Button onClick={handleSignIn} size="lg" className="gap-2">
                    Sign in with Google
                </Button>
            </div>
        </div>
    );
}
