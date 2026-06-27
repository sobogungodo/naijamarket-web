// ============================================================================
// src/lib/lang.tsx — Language context for the consumer web.
//
// Mirrors the naijamarket-mobile lib/lang.ts store, adapted to React context
// (same model as the app's next-themes ThemeProvider):
//   • Source of truth: Consumers.preferred_language (shared with WA + mobile)
//   • Instant client switching via localStorage('naijamarket-lang')
//   • SSR-safe: server and first client render are both DEFAULT_LANG, then we
//     reconcile in an effect — so there is no hydration mismatch.
//
// DB calls are best-effort: an unauthenticated visitor just gets the
// localStorage value (the /api/account/language GET returns 401, ignored).
// ============================================================================
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { type Lang, type StringKey, t as translate } from "@/lib/i18n";

const STORAGE_KEY = "naijamarket-lang";
const DEFAULT_LANG: Lang = "en";

function normLang(v: unknown): Lang {
  return v === "pcm" || (typeof v === "string" && v.toLowerCase() === "pcm")
    ? "pcm"
    : "en";
}

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Translate a key in the current language. */
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const LangContext = createContext<LangContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // ── Hydrate after mount (SSR-safe) ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // 1) localStorage first — instant, works for anonymous visitors
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setLangState(normLang(stored));
    } catch {
      /* ignore */
    }

    // 2) reconcile with the account's saved preference (DB wins if set)
    (async () => {
      try {
        const res = await fetch("/api/account/language", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const dbLang = data?.language;
        if (dbLang) {
          const norm = normLang(dbLang);
          setLangState(norm);
          try {
            localStorage.setItem(STORAGE_KEY, norm);
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* anonymous or offline — keep localStorage value */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    const norm = normLang(next);
    setLangState(norm);
    try {
      localStorage.setItem(STORAGE_KEY, norm);
    } catch {
      /* ignore */
    }
    // Persist to the shared preferred_language column (fire-and-forget)
    fetch("/api/account/language", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: norm }),
    }).catch(() => {
      /* offline — localStorage already updated, will sync next change */
    });
  }, []);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) =>
      translate(key, lang, vars),
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Safe fallback so a component used outside the provider still renders EN.
    return {
      lang: DEFAULT_LANG,
      setLang: () => {},
      t: (key, vars) => translate(key, DEFAULT_LANG, vars),
    };
  }
  return ctx;
}
