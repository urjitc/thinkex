"use client";

import { Component, ReactNode } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantRuntime } from "@assistant-ui/react";
import { toast } from "sonner";

interface Props {
    runtime: AssistantRuntime;
    children: ReactNode;
}

interface State {
    hasError: boolean;
    remountKey: number;
}

export class SafeAssistantRuntimeProvider extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, remountKey: 0 };
    }

    static getDerivedStateFromError(error: unknown) {
        return { hasError: true };
    }

    componentDidCatch(error: unknown, errorInfo: unknown) {
        // Only suppress the known tapLookupResources error which is transient
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage.includes("tapLookupResources") || errorMessage.includes("Resource not found")) {
            console.warn("[SafeAssistantRuntimeProvider] Caught transient runtime error, attempting graceful recovery:", error);
            // Attempt to recover by resetting error state and incrementing remount key after a short delay
            // This allows the tree to re-mount with a fresh key, hopefully after the race condition passes
            setTimeout(() => {
                if (this.state.hasError) {
                    this.setState({ 
                        hasError: false,
                        remountKey: this.state.remountKey + 1
                    });
                }
            }, 50);
        } else {
            console.error("[SafeAssistantRuntimeProvider] Unhandled error:", error, errorInfo);
        }
    }

    componentDidUpdate(prevProps: Props) {
        // If runtime changed, try to recover from error state
        if (prevProps.runtime !== this.props.runtime && this.state.hasError) {
            this.setState({ 
                hasError: false,
                remountKey: this.state.remountKey + 1
            });
        }
    }

    render() {
        // During error state, render children without AssistantRuntimeProvider to avoid gray screen
        // Assistant features will be temporarily unavailable, but UI remains visible
        if (this.state.hasError) {
            return <>{this.props.children}</>;
        }

        // Use remountKey to force complete remount of AssistantRuntimeProvider on recovery
        // This ensures a clean state after error recovery
        return (
            <AssistantRuntimeProvider 
                key={this.state.remountKey}
                runtime={this.props.runtime}
            >
                {this.props.children}
            </AssistantRuntimeProvider>
        );
    }
}
