
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ArrowRight, UserPlus, LogIn } from "lucide-react";

interface InviteLandingPageProps {
    token: string;
}

interface InviteDetails {
    email: string;
    workspaceName: string;
    inviterName: string;
    inviterImage?: string;
}

export function InviteLandingPage({ token }: InviteLandingPageProps) {
    const router = useRouter();
    const [details, setDetails] = useState<InviteDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchInvite() {
            if (!token) return;

            try {
                const res = await fetch(`/api/invites/${token}`);
                if (res.ok) {
                    const data = await res.json();
                    setDetails(data);
                } else {
                    const err = await res.json();
                    setError(err.error || "Failed to load invite");
                }
            } catch (e) {
                setError("Something went wrong");
            } finally {
                setLoading(false);
            }
        }
        fetchInvite();
    }, [token]);

    const handleAction = (action: 'signin' | 'signup') => {
        // Redirect to auth page with pre-filled email if available
        // We pass the callback URL back to the current page (which has the invite param)
        // So after auth, they return here and the "auto-claim" logic kicks in
        const currentUrl = window.location.href;
        const authPath = action === 'signin' ? '/auth/sign-in' : '/auth/sign-up';
        const emailParam = details?.email ? `&email=${encodeURIComponent(details.email)}` : '';

        router.push(`${authPath}?callbackUrl=${encodeURIComponent(currentUrl)}${emailParam}`);
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black/95">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black/95 p-4">
                <Card className="max-w-md w-full border-red-500/20 bg-black">
                    <CardHeader>
                        <CardTitle className="text-red-500">Invalid Invite</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardFooter>
                        <Button onClick={() => router.push('/')} variant="ghost">Go Home</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-black/95 relative overflow-hidden">
            {/* Abstract Background */}
            <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:50px_50px]" />
            <div className="absolute h-full w-full bg-black [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />

            <Card className="max-w-md w-full border-white/10 bg-black/50 backdrop-blur-xl relative z-10 shadow-2xl">
                <CardHeader className="text-center space-y-4 pb-2">
                    <div className="mx-auto bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mb-2">
                        <Avatar className="h-14 w-14 border-2 border-black">
                            <AvatarImage src={details?.inviterImage} />
                            <AvatarFallback className="bg-primary/20 text-primary uppercase font-bold text-xl">
                                {details?.inviterName?.slice(0, 2)}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                        You've been invited!
                    </CardTitle>
                    <CardDescription className="text-base text-zinc-400">
                        <span className="font-semibold text-white">{details?.inviterName}</span> has invited you to join the <span className="font-semibold text-white">{details?.workspaceName}</span> workspace on ThinkEx.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-6">
                    <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-indigo-500/20 flex items-center justify-center shrink-0">
                            <UserPlus className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">{details?.email}</p>
                            <p className="text-xs text-zinc-500">Your invite is linked to this email.</p>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                    <Button
                        onClick={() => handleAction('signup')}
                        className="w-full h-11 text-base font-medium shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
                    >
                        Create Account
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button
                        onClick={() => handleAction('signin')}
                        variant="ghost"
                        className="w-full text-zinc-400 hover:text-white"
                    >
                        Start Session
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
