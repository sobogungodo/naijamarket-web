// ============================================================================
// src/components/LanguageToggle.tsx
// Compact EN / PCM language switcher. Reads + writes the shared language via
// useLang() (localStorage + Consumers.preferred_language).
// ============================================================================
"use client";

import { useLang } from "@/lib/lang";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div
      className={`flex items-center rounded-lg border border-terminal-border bg-terminal-surface p-0.5 text-2xs font-semibold ${className}`}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={`px-2 py-1 rounded-md transition-colors ${
          lang === "en" ? "bg-emerald-500 text-white" : "text-gray-400 hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("pcm")}
        aria-pressed={lang === "pcm"}
        className={`px-2 py-1 rounded-md transition-colors ${
          lang === "pcm" ? "bg-emerald-500 text-white" : "text-gray-400 hover:text-white"
        }`}
      >
        PG
      </button>
    </div>
  );
}
