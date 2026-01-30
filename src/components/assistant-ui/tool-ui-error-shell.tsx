"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ToolUIErrorShellProps {
  /** Main label shown next to the X icon (e.g. "Failed to create note") */
  label: string;
  /** Optional error message with more details */
  message?: string;
  className?: string;
}

/**
 * Shared error shell for assistant-ui tool UIs. Card-style layout with
 * X icon + label (+ optional message). Use when status.type === "incomplete" with error.
 * Matches the subtle styling of ToolUILoadingShell for consistency.
 */
export function ToolUIErrorShell({
  label,
  message,
  className,
}: ToolUIErrorShellProps) {
  return (
    <div
      className={cn(
        "my-1 flex w-full items-center justify-between overflow-hidden rounded-md border border-border/50 bg-card/50 text-card-foreground shadow-sm px-2 py-2",
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex size-4 items-center justify-center text-muted-foreground">
          <X className="size-4" />
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium truncate">
            {label}
          </span>
          {message && (
            <span className="text-[10px] text-muted-foreground truncate">{message}</span>
          )}
        </div>
      </div>
    </div>
  );
}
