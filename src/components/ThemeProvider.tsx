"use client";

// ============================================================================
// src/components/ThemeProvider.tsx
// NaijaMarket Intel — Theme Provider wrapper
// Thin wrapper around next-themes so we can keep layout.tsx as a server component
// ============================================================================

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
