"use client";

import { useAuiState } from "@assistant-ui/react";
import { useState, useEffect } from "react";
import ShinyText from "@/components/ShinyText";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const thinkingMessages = [
    "Thinking",
    "Planning next moves",
    "Analyzing context",
    "Formulating response",
    "Gathering insights",
    "Almost there",
];

export const AssistantLoader = () => {
    const isRunning = useAuiState(
        ({ message }) => (message as { status?: { type: string } })?.status?.type === "running"
    );

    const isMessageEmpty = useAuiState(({ message }) => {
        const msg = message as any;
        return !msg?.content || (Array.isArray(msg.content) && msg.content.length === 0);
    });

    const [currentMessage, setCurrentMessage] = useState("Thinking");
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        if (!isRunning || !isMessageEmpty) {
            setCurrentMessage("Thinking");
            setHasStarted(false);
            return;
        }

        // Start with "Thinking" for the first 3 seconds
        if (!hasStarted) {
            const initialTimer = setTimeout(() => {
                setHasStarted(true);
            }, 3000);
            return () => clearTimeout(initialTimer);
        }

        // After initial delay, cycle through random messages
        const interval = setInterval(() => {
            const randomMessages = thinkingMessages.filter(msg => msg !== "Thinking");
            const randomIndex = Math.floor(Math.random() * randomMessages.length);
            setCurrentMessage(randomMessages[randomIndex]);
        }, 3000);

        return () => clearInterval(interval);
    }, [isRunning, isMessageEmpty, hasStarted]);

    if (!isRunning || !isMessageEmpty) return null;

    return (
        <div className="flex items-center gap-3 py-2">
            <DotLottieReact
                src="/logo.lottie"
                loop
                autoplay
                mode="bounce"
                className="w-4 h-4 self-center"
            />
            <ShinyText
                text={currentMessage}
                disabled={false}
                speed={1.5}
                className="text-base text-muted-foreground"
            />
        </div>
    );
};
