"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { getCardColorCSS } from "@/lib/workspace-state/colors";
import type { CardColor } from "@/lib/workspace-state/colors";

// Random card colors for background
const cardColors: CardColor[] = [
  "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
];

// Random card positions and sizes (static - no parallax)
const backgroundCards = [
  { top: "10%", left: "5%", width: "180px", height: "140px", color: cardColors[0], rotation: -3 },
  { top: "25%", left: "75%", width: "200px", height: "160px", color: cardColors[1], rotation: 2 },
  { top: "50%", left: "5%", width: "160px", height: "120px", color: cardColors[2], rotation: -2 },
  { top: "65%", left: "80%", width: "190px", height: "150px", color: cardColors[3], rotation: 3 },
  { top: "8%", left: "85%", width: "150px", height: "110px", color: cardColors[5], rotation: -1 },
  { top: "75%", left: "25%", width: "180px", height: "140px", color: cardColors[6], rotation: 2 },
  { top: "30%", left: "20%", width: "160px", height: "120px", color: cardColors[7], rotation: -2 },
];

interface BackgroundCardProps {
  card: typeof backgroundCards[0];
  isMobileOnly?: boolean;
}

function BackgroundCard({ card, isMobileOnly = false }: BackgroundCardProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: card.top,
        left: card.left,
        width: card.width,
        height: card.height,
        backgroundColor: getCardColorCSS(card.color as CardColor, 0.5),
        transform: `rotate(${card.rotation}deg)`,
        opacity: 0.5,
      }}
      className={`rounded-md border border-foreground/20 shadow-xl ${isMobileOnly ? 'hidden md:block' : ''}`}
    >
      {/* Card content placeholder */}
      <div className="p-3 h-full flex flex-col gap-2">
        <div className="h-2 w-3/4 rounded bg-foreground/20" />
        <div className="h-1.5 w-full rounded bg-foreground/15" />
        <div className="h-1.5 w-5/6 rounded bg-foreground/15" />
        <div className="flex-1" />
        <div className="h-1 w-1/2 rounded bg-foreground/10" />
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 md:py-24 sm:px-6 lg:px-8"
    >
      {/* Workspace Background Elements */}
      <div className="absolute inset-0 z-0 opacity-40">
        {/* Static Background Cards */}
        {backgroundCards.map((card, index) => {
          const isMobileOnly = index >= 3;
          return (
            <BackgroundCard
              key={index}
              card={card}
              isMobileOnly={isMobileOnly}
            />
          );
        })}

        {/* Gradient fade-out at bottom */}
        <div
          className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
          style={{
            background: `linear-gradient(to bottom, transparent 0%, var(--background) 100%)`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <div className="space-y-8 md:space-y-12 text-center">
          {/* Backed by Section */}
          <a
            href="https://www.hatchery.umd.edu/about-mokhtarzadas"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-base md:text-lg text-muted-foreground mb-2 md:mb-4 hover:text-foreground transition-colors cursor-pointer"
          >
            <Image
              src="/hatchery.png"
              alt="Mokhtarzada Hatchery"
              width={140}
              height={28}
              className="h-6 md:h-7 w-auto"
            />
            <span>Mokhtarzada Hatchery 2025 Cohort</span>
          </a>

          {/* Header - Above Video */}
          <h1 className="mt-4 md:mt-12 text-4xl font-normal tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Turn{" "}
            <span className="relative inline-block">
              <span className="relative px-3 py-0.5 rounded-sm inline-block">
                <span
                  className="absolute inset-0 rounded-sm border-4"
                  style={{
                    background: "rgba(252, 211, 77, 0.15)",
                    borderColor: "#EAB308",
                    boxShadow: "0 0 0 1px rgba(234, 179, 8, 0.3)",
                    left: "2px",
                  }}
                />
                <span className="relative z-10">value from AI</span>
              </span>
            </span>{" "}
            into
            <br />
            organized knowledge
          </h1>

          {/* Get Started Button - Above Video */}
          <div className="flex justify-center">
            <Link href="/guest-setup">
              <Button
                size="lg"
                className="h-12 rounded-md bg-foreground px-8 text-base font-medium text-background transition-all hover:bg-foreground/90"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Mobile Demo Image - Only visible on mobile */}
          <div className="relative w-full md:hidden">
            <div className="relative w-full max-w-md mx-auto px-4">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-foreground/20 shadow-2xl">
                <Image
                  src="/demo.png"
                  alt="ThinkEx Demo"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>

          {/* Desktop Demo Image - Hidden on mobile */}
          <div className="relative w-full hidden md:block">
            <div className="relative w-full max-w-5xl mx-auto px-4">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-foreground/20 shadow-2xl">
                <Image
                  src="/demo.png"
                  alt="ThinkEx Demo"
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
