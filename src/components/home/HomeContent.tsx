"use client";

import { HomePromptInput } from "./HomePromptInput";
// import { FeaturedWorkspaces } from "./FeaturedWorkspaces";
import { WorkspaceGrid } from "./WorkspaceGrid";

export function HomeContent() {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center px-6 overflow-y-auto">
        {/* Hero Section - Fixed top spacing */}
        <div className="text-center w-full flex-shrink-0 pt-16 md:pt-24 pb-12 md:pb-16">
          <h1 className="text-2xl md:text-3xl font-normal text-foreground mb-6">
            What's on your mind?
          </h1>
          <div className="flex justify-center">
            <HomePromptInput />
          </div>
        </div>

        {/* Content Sections - Fixed spacing from hero */}
        <div className="w-full max-w-6xl pb-8 space-y-12 flex-shrink-0">
          {/* Featured Workspaces */}
          {/* <FeaturedWorkspaces /> */}

          {/* Your Workspaces */}
          <WorkspaceGrid />
        </div>
      </div>
    </div>
  );
}
