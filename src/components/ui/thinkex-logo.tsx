"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ThinkExLogoProps {
  size?: 24 | 32;
  className?: string;
  priority?: boolean;
}

export function ThinkExLogo({ size = 24, className, priority }: ThinkExLogoProps) {
  const { resolvedTheme } = useTheme();
  // Default to dark when undefined (SSR/pre-hydration) - app defaults to dark
  const isDark = resolvedTheme !== "light";

  const src = isDark ? "/newlogothinkex-dark.svg" : "/newlogothinkex-light.svg";

  return (
    <Image
      src={src}
      alt="ThinkEx Logo"
      width={size}
      height={size}
      className={cn("object-contain", className)}
      priority={priority}
    />
  );
}
