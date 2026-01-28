"use client";

import { HomePromptInput } from "./HomePromptInput";
// import { FeaturedWorkspaces } from "./FeaturedWorkspaces";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { FloatingWorkspaceCards } from "@/components/landing/FloatingWorkspaceCards";

export function HomeContent() {
  return (
    <div className="relative h-full w-full overflow-y-auto">
      {/* Floating Card Background */}
      <div className="absolute inset-0 z-0 select-none pointer-events-none overflow-hidden">
        <FloatingWorkspaceCards 
          bottomGradientHeight="40%" 
          opacity="opacity-10 md:opacity-15"
          includeExtraCards={true}
        />
      </div>

      {/* Hero Section - Vertically centered in viewport */}
      <div className="relative z-10 min-h-[90vh] flex flex-col items-center justify-center text-center px-6 py-0">
        <div className="w-full max-w-2xl -mt-16 relative">
          {/* Radial blur overlay around prompt */}
          <div 
            className="absolute -inset-12 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.3) 30%, rgba(0, 0, 0, 0.1) 50%, transparent 70%)',
              filter: 'blur(20px)',
              zIndex: 0,
              width: 'calc(100% + 6rem)',
              height: '400px',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
          
          <h1 className="text-2xl md:text-3xl font-normal text-foreground mb-10 relative z-10">
            What's on your mind?
          </h1>
          <div className="flex justify-center w-full relative z-10">
            <HomePromptInput />
          </div>
        </div>
      </div>

      {/* Content Sections - Below hero */}
      <div className="relative z-10 px-6 pb-8">
        <div className="w-full max-w-6xl mx-auto space-y-12">
          {/* Featured Workspaces */}
          {/* <FeaturedWorkspaces /> */}

          {/* Your Workspaces */}
          <WorkspaceGrid />
        </div>
      </div>
    </div>
  );
}
