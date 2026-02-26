"use client";
// src/components/blog/BlogNavbar.tsx
// CORRECT pattern: light = default styles, dark: = dark overrides

import { useState, useEffect } from "react";
import Link from "next/link";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

export default function BlogNavbar() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("naijamarket-theme") as Theme | null;
    setTheme(stored || "dark");
    setMounted(true);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    const resolved =
      newTheme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        : newTheme;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
    localStorage.setItem("naijamarket-theme", newTheme);
    setTheme(newTheme);
  };

  if (!mounted) return null;

  return (
    <nav className="sticky top-0 z-50 border-b
                    bg-white/95 border-gray-200
                    dark:bg-[#0a0a0a]/95 dark:border-gray-800
                    backdrop-blur-xl transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">NM</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white text-sm">
            NaijaMarket<span className="text-emerald-500 dark:text-emerald-400">Intel</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/#features"     className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Features</Link>
          <Link href="/#pricing"      className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Pricing</Link>
          <Link href="/blog"          className="text-emerald-600 dark:text-emerald-400 font-medium">Blog</Link>
          <Link href="/#how-it-works" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">How It Works</Link>
        </div>

        {/* Right: toggle + CTA */}
        <div className="flex items-center gap-3">

          {/* Theme toggle — light default, dark: overrides */}
          <div className="flex items-center gap-1 rounded-lg p-1
                          bg-gray-100 border border-gray-300
                          dark:bg-[#1a1a1a] dark:border-gray-700">
            <button
              onClick={() => applyTheme("light")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                theme === "light"
                  ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Light
            </button>
            <button
              onClick={() => applyTheme("dark")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                theme === "dark"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Dark
            </button>
            <button
              onClick={() => applyTheme("system")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                theme === "system"
                  ? "bg-emerald-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Auto
            </button>
          </div>

          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors hidden md:block">
            Sign In
          </Link>
          <Link href="/register" className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium rounded-lg transition-colors">
            Get Started Free
          </Link>
        </div>
      </div>
    </nav>
  );
}
