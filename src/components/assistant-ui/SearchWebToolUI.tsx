"use client";

import { SearchIcon, ChevronDownIcon, ExternalLink } from "lucide-react";
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type FC,
  type PropsWithChildren,
} from "react";

import {
  useScrollLock,
  makeAssistantToolUI,
} from "@assistant-ui/react";

import { StandaloneMarkdown } from "@/components/assistant-ui/standalone-markdown";
import { Source, SourceIcon, SourceTitle } from "@/components/assistant-ui/sources";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import ShinyText from "@/components/ShinyText";

const ANIMATION_DURATION = 200;
const SHIMMER_DURATION = 1000;

/**
 * Parse sources from markdown result.
 * Looks for **Sources:** section and extracts URLs.
 */
function parseSourcesFromResult(result: string): {
  content: string;
  sources: Array<{ url: string; title?: string }>;
} {
  // Look for **Sources:** section
  const sourcesMatch = result.match(/\n\n\*\*Sources:\*\*\n([\s\S]*?)$/);

  if (!sourcesMatch) {
    return { content: result, sources: [] };
  }

  // Extract content without sources section
  const content = result.replace(/\n\n\*\*Sources:\*\*\n[\s\S]*?$/, "").trim();

  // Parse source lines - format: "1. [url](url)" or "1. title"
  const sourcesText = sourcesMatch[1];
  const sources: Array<{ url: string; title?: string }> = [];

  // Match markdown links: [text](url) or plain URLs
  const linkRegex = /\d+\.\s*\[([^\]]+)\]\(([^)]+)\)/g;
  const plainUrlRegex = /\d+\.\s*(https?:\/\/[^\s]+)/g;

  let match;
  while ((match = linkRegex.exec(sourcesText)) !== null) {
    const [, text, url] = match;
    // If text is the same as URL, don't set title
    sources.push({
      url: url,
      title: text !== url ? text : undefined,
    });
  }

  // Also check for plain URLs (not in markdown format)
  while ((match = plainUrlRegex.exec(sourcesText)) !== null) {
    const url = match[1];
    // Avoid duplicates
    if (!sources.some(s => s.url === url)) {
      sources.push({ url });
    }
  }

  return { content, sources };
}

/**
 * Root collapsible container that manages open/closed state and scroll lock.
 */
const ToolRoot: FC<
  PropsWithChildren<{
    className?: string;
  }>
> = ({ className, children }) => {
  const collapsibleRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
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
  sourceCount?: number;
  className?: string;
}> = ({
  active,
  label,
  icon,
  sourceCount,
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
      {sourceCount !== undefined && sourceCount > 0 && (
        <span className="text-xs text-muted-foreground/60">
          ({sourceCount} source{sourceCount !== 1 ? "s" : ""})
        </span>
      )}
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

/**
 * Text content wrapper that animates the tool text visibility.
 */
const ToolText: FC<
  PropsWithChildren<{
    className?: string;
  }>
> = ({ className, children }) => (
  <div
    className={cn(
      "aui-tool-text relative z-0 space-y-4 pt-4 pl-6 leading-relaxed",
      "transform-gpu transition-[transform,opacity]",
      "group-data-[state=open]/collapsible-content:animate-in",
      "group-data-[state=closed]/collapsible-content:animate-out",
      "group-data-[state=open]/collapsible-content:fade-in-0",
      "group-data-[state=closed]/collapsible-content:fade-out-0",
      "group-data-[state=open]/collapsible-content:slide-in-from-top-4",
      "group-data-[state=closed]/collapsible-content:slide-out-to-top-4",
      "group-data-[state=open]/collapsible-content:duration-(--animation-duration)",
      "group-data-[state=closed]/collapsible-content:duration-(--animation-duration)",
      "[&_p]:-mb-2",
      className,
    )}
  >
    {children}
  </div>
);

ToolText.displayName = "ToolText";

/**
 * Sources display component with favicons.
 */
const SourcesDisplay: FC<{
  sources: Array<{ url: string; title?: string }>;
}> = ({ sources }) => {
  if (sources.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground/70">
        Sources:
      </span>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, index) => {
          // Extract domain for display if no title
          let displayTitle = source.title;
          if (!displayTitle) {
            try {
              displayTitle = new URL(source.url).hostname.replace(/^www\./, "");
            } catch {
              displayTitle = source.url;
            }
          }

          return (
            <Source
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="outline"
              className="gap-1.5"
            >
              <SourceIcon url={source.url} className="size-3.5" />
              <SourceTitle className="max-w-[150px]">{displayTitle}</SourceTitle>
              <ExternalLink className="size-3 opacity-50" />
            </Source>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Tool UI component for searchWeb tool.
 * Displays search query and results in a collapsible format with parsed sources.
 */
export const SearchWebToolUI = makeAssistantToolUI<{
  query: string;
}, string>({
  toolName: "searchWeb",
  render: function SearchWebToolUI({ args, status, result }) {
    const isRunning = status.type === "running";
    const hasResult = result !== undefined && result !== null;

    // Parse sources from the result
    const parsedResult = useMemo(() => {
      if (!hasResult) return { content: "", sources: [] };
      return parseSourcesFromResult(result);
    }, [hasResult, result]);

    return (
      <ToolRoot>
        <ToolTrigger
          active={isRunning}
          label={isRunning ? "Searching web" : "Searched web"}
          icon={<SearchIcon className="aui-tool-trigger-icon size-4 shrink-0" />}
          sourceCount={parsedResult.sources.length}
        />

        <ToolContent aria-busy={isRunning}>
          <ToolText>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-muted-foreground/70">
                  Query:
                </span>
                <p className="mt-1 text-foreground">{args.query}</p>
              </div>

              {isRunning && (
                <div className="text-xs text-muted-foreground/60">
                  Searching...
                </div>
              )}

              {hasResult && (
                <>
                  <div>
                    <span className="text-xs font-medium text-muted-foreground/70">
                      Results:
                    </span>
                    <div className="mt-2">
                      <StandaloneMarkdown>{parsedResult.content}</StandaloneMarkdown>
                    </div>
                  </div>

                  {/* Sources with favicons */}
                  <SourcesDisplay sources={parsedResult.sources} />
                </>
              )}
            </div>
          </ToolText>
        </ToolContent>
      </ToolRoot>
    );
  },
});


