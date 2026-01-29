"use client";

import { makeAssistantToolUI, useScrollLock } from "@assistant-ui/react";
import { Loader2, Check, Youtube, ChevronDownIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useCallback, type FC, type PropsWithChildren } from "react";
import { useNavigateToItem } from "@/hooks/ui/use-navigate-to-item";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ShinyText";
import { ToolUIErrorBoundary } from "@/components/tool-ui/shared";
import { useOptimisticToolUpdate } from "@/hooks/ai/use-optimistic-tool-update";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

const ANIMATION_DURATION = 200;
const SHIMMER_DURATION = 1000;

/**
 * Root collapsible container that manages open/closed state and scroll lock.
 */
const ToolRoot: FC<
    PropsWithChildren<{
        className?: string;
        defaultOpen?: boolean;
    }>
> = ({ className, children, defaultOpen = false }) => {
    const collapsibleRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                lockScroll();
            }
            setIsOpen(open);
        },
        [lockScroll],
    );

    return (
        <Collapsible
            ref={collapsibleRef}
            open={isOpen}
            onOpenChange={handleOpenChange}
            className={cn("aui-tool-root mb-4 w-full", className)}
            style={
                {
                    "--animation-duration": `${ANIMATION_DURATION}ms`,
                    "--shimmer-duration": `${SHIMMER_DURATION}ms`,
                } as React.CSSProperties
            }
        >
            {children}
        </Collapsible>
    );
};

ToolRoot.displayName = "ToolRoot";

/**
 * Gradient overlay that softens the bottom edge during expand/collapse animations.
 */
const GradientFade: FC<{ className?: string }> = ({ className }) => (
    <div
        className={cn(
            "aui-tool-fade pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16",
            "bg-[linear-gradient(to_top,var(--color-background),transparent)]",
            "animate-in fade-in-0",
            "group-data-[state=open]/collapsible-content:animate-out",
            "group-data-[state=open]/collapsible-content:fade-out-0",
            "group-data-[state=open]/collapsible-content:delay-[calc(var(--animation-duration)*0.75)]",
            "group-data-[state=open]/collapsible-content:fill-mode-forwards",
            "duration-(--animation-duration)",
            "group-data-[state=open]/collapsible-content:duration-(--animation-duration)",
            className,
        )}
    />
);

/**
 * Trigger button for the tool collapsible.
 */
const ToolTrigger: FC<{
    active: boolean;
    label: string;
    icon: React.ReactNode;
    className?: string;
}> = ({
    active,
    label,
    icon,
    className,
}) => (
        <CollapsibleTrigger
            className={cn(
                "aui-tool-trigger group/trigger -mb-2 flex max-w-[75%] items-center gap-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                className,
            )}
        >
            {icon}
            <span className="aui-tool-trigger-label-wrapper relative inline-block leading-none">
                {active ? (
                    <ShinyText
                        text={label}
                        disabled={false}
                        speed={1.5}
                        className="text-sm"
                    />
                ) : (
                    <span>{label}</span>
                )}
            </span>
            <ChevronDownIcon
                className={cn(
                    "aui-tool-trigger-chevron mt-0.5 size-4 shrink-0",
                    "transition-transform duration-(--animation-duration) ease-out",
                    "group-data-[state=closed]/trigger:-rotate-90",
                    "group-data-[state=open]/trigger:rotate-0",
                )}
            />
        </CollapsibleTrigger>
    );

/**
 * Collapsible content wrapper that handles height expand/collapse animation.
 */
const ToolContent: FC<
    PropsWithChildren<{
        className?: string;
        "aria-busy"?: boolean;
    }>
> = ({ className, children, "aria-busy": ariaBusy }) => (
    <CollapsibleContent
        className={cn(
            "aui-tool-content relative overflow-hidden text-sm text-muted-foreground outline-none",
            "group/collapsible-content ease-out",
            "data-[state=closed]:animate-collapsible-up",
            "data-[state=open]:animate-collapsible-down",
            "data-[state=closed]:fill-mode-forwards",
            "data-[state=closed]:pointer-events-none",
            "data-[state=open]:duration-(--animation-duration)",
            "data-[state=closed]:duration-(--animation-duration)",
            className,
        )}
        aria-busy={ariaBusy}
    >
        {children}
        <GradientFade />
    </CollapsibleContent>
);

ToolContent.displayName = "ToolContent";

interface AddYoutubeVideoArgs {
    videoId: string;
    title: string;
}

interface AddYoutubeVideoResult {
    success: boolean;
    message?: string;
    id?: string; // ID of the created item
}

const AddYoutubeVideoContent: FC<{
    args: AddYoutubeVideoArgs;
    status: { type: string };
    result: AddYoutubeVideoResult | null;
}> = ({ args, status, result }) => {
    const isRunning = status.type === "running";
    const navigateToItem = useNavigateToItem();

    const handleViewVideo = () => {
        if (result?.id) {
            navigateToItem(result.id);
        }
    };

    return (
        <ToolRoot defaultOpen={true}>
            <ToolTrigger
                active={isRunning}
                label={isRunning ? "Adding Video..." : "Video Added"}
                icon={isRunning
                    ? <Loader2 className="aui-tool-trigger-icon size-4 shrink-0 animate-spin" />
                    : <Youtube className="aui-tool-trigger-icon size-4 shrink-0" />
                }
            />

            <ToolContent aria-busy={isRunning}>
                <div className="pt-4 pl-4 space-y-3">
                    {/* Video Info */}
                    <div className="flex gap-3 bg-muted/30 p-3 rounded-md border border-border/50">
                        <div className="relative shrink-0 w-24 aspect-video rounded-sm overflow-hidden bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`https://img.youtube.com/vi/${args.videoId}/mqdefault.jpg`}
                                alt={args.title}
                                className="object-cover w-full h-full"
                            />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0 justify-center">
                            <h4 className="font-medium text-sm line-clamp-2 leading-tight text-foreground" title={args.title}>
                                {args.title}
                            </h4>
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <Youtube className="size-3" />
                                <span>YouTube Video</span>
                            </div>
                        </div>
                    </div>

                    {/* Result Status */}
                    {status.type === "complete" && result && (
                        <div className="mt-2">
                            {result.success ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-green-600 dark:text-green-500 text-sm">
                                        <Check className="size-4" />
                                        <span>Successfully added to workspace</span>
                                    </div>
                                    {result.id && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs gap-1"
                                            onClick={handleViewVideo}
                                        >
                                            View Video
                                            <ExternalLink className="size-3" />
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="text-red-500 text-sm">
                                    Error: {result.message || "Failed to add video"}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ToolContent>
        </ToolRoot>
    );
};

export const AddYoutubeVideoToolUI = makeAssistantToolUI<AddYoutubeVideoArgs, AddYoutubeVideoResult>({
    toolName: "addYoutubeVideo",
    render: function AddYoutubeVideoToolUI({ args, status, result }) {
        const workspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
        useOptimisticToolUpdate(status, result, workspaceId);

        return (
            <ToolUIErrorBoundary componentName="AddYoutubeVideo">
                <AddYoutubeVideoContent args={args} status={status} result={result ?? null} />
            </ToolUIErrorBoundary>
        );
    },
});
