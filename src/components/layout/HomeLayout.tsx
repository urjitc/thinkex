"use client";

import { GridPattern } from "@/components/ui/shadcn-io/grid-pattern";

interface HomeLayoutProps {
  children: React.ReactNode;
}

/**
 * Simplified layout for home page.
 * No sidebar - uses a top bar navigation instead.
 */
export function HomeLayout({ children }: HomeLayoutProps) {
  return (
    <div className="h-screen w-full overflow-hidden">
      <GridPattern
        width={30}
        height={30}
        className="opacity-10"
        id="home-grid-pattern"
      />
      <div className="h-full overflow-hidden relative z-10">
        {children}
      </div>
    </div>
  );
}
