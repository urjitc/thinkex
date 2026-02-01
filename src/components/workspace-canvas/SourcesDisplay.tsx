"use client";

import type { Source } from "@/lib/workspace-state/types";
import { ExternalLink } from "lucide-react";

interface SourcesDisplayProps {
    sources: Source[];
}

/**
 * SourcesDisplay - Renders a polished "References" section for notes
 * Displays sources as a grid of clickable cards at the bottom of note content
 */
export function SourcesDisplay({ sources }: SourcesDisplayProps) {
    if (!sources || sources.length === 0) {
        return null;
    }

    return (
        <div className="mt-8 pt-6 border-t border-white/10">
            <h3 className="text-sm font-semibold text-white/70 mb-4">
                References ({sources.length})
            </h3>
            <div className="grid grid-cols-1 gap-3">
                {sources.map((source, index) => {
                    let hostname = "";
                    try {
                        hostname = new URL(source.url).hostname;
                    } catch {
                        hostname = source.url;
                    }

                    return (
                        <a
                            key={index}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-200"
                        >
                            <div className="flex-shrink-0 mt-0.5">
                                <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-white/60" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white/90 group-hover:text-white line-clamp-2 mb-1">
                                    {source.title}
                                </div>
                                <div className="text-xs text-white/50 truncate">
                                    {hostname}
                                </div>
                            </div>
                        </a>
                    );
                })}
            </div>
        </div>
    );
}

export default SourcesDisplay;
