"use client";

import { Component, ReactNode } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { AssistantRuntime } from "@assistant-ui/react";

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
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if this is a known transient runtime error
        const isTransientError = 
            errorMessage.includes("tapLookupResources") || 
            errorMessage.includes("Resource not found") ||
            errorMessage.includes("ThreadListItemRuntime is not available");

        if (isTransientError) {
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
            }, 100);
        } else {
            console.error("[SafeAssistantRuntimeProvider] Unhandled error:", error, errorInfo);
            // For non-transient errors, still try to recover after a longer delay
            setTimeout(() => {
                if (this.state.hasError) {
                    this.setState({ 
                        hasError: false,
                        remountKey: this.state.remountKey + 1
                    });
                }
            }, 500);
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
        if (this.state.hasError) {
            // During error state, render a minimal invisible placeholder
            // This prevents gray screen while avoiding hook errors from children
            // The setTimeout in componentDidCatch will trigger recovery
            return (
                <div 
                    style={{ 
                        position: 'absolute', 
                        width: '100%', 
                        height: '100%',
                        opacity: 0,
                        pointerEvents: 'none'
                    }} 
                    aria-hidden="true"
                />
            );
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
