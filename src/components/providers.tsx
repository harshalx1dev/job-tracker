"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeLab } from "@/components/theme-lab";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {/* One ease for every UI step, no spring overshoot (motion tokens). */}
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <NuqsAdapter>
          <TooltipProvider>
            {children}
            <Toaster position="bottom-center" />
            {process.env.NEXT_PUBLIC_THEME_LAB !== "off" && <ThemeLab />}
          </TooltipProvider>
        </NuqsAdapter>
      </MotionConfig>
    </ThemeProvider>
  );
}
