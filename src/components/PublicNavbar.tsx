"use client";

// ============================================================================
// src/components/PublicNavbar.tsx
// NaijaMarket Intel — Shared Public Navbar
//
// Used by: home (page.tsx), /pricing, /privacy, /terms, /blog, and any
// other public-facing page.
//
// FIX: Uses useTheme() from next-themes instead of local useState + localStorage.
//      This means ONE theme state across ALL pages — changing theme on home
//      persists to pricing, privacy, blog, etc.
// ============================================================================

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

export default function PublicNavbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Must wait for mount to avoid hydration mismatch
  // (server doesn't know the stored theme)
  useEffect(() => setMounted(true), []);

  return (
    <nav className="sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-200
                    bg-white/95 border-gray-200
                    dark:bg-[#0a0a0a]/95 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* ── Logo ─────────────────────────────────────────────────────── */}
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <Image
            src="/logo.png"
            alt="NaijaMarket Intel"
            width={48}
            height={48}
            className="rounded-full"
          />
        </Link>

        {/* ── Nav Links ────────────────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/#features"
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            Features
          </Link>
          <Link href="/pricing"
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/#how-it-works"
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            How It Works
          </Link>
        </div>

        {/* ── Right Side: Theme Toggle + Auth CTAs ─────────────────────── */}
        <div className="flex items-center gap-3">

          {/* Theme Toggle — 3-way: Light | Dark | Auto */}
          {/* Render placeholder during SSR to avoid hydration mismatch */}
          {!mounted ? (
            <div className="w-[120px] h-8 rounded-lg bg-gray-100 dark:bg-[#1a1a1a] animate-pulse" />
          ) : (
            <div className="flex items-center gap-0.5 rounded-lg p-1
                            bg-gray-100 border border-gray-300
                            dark:bg-[#1a1a1a] dark:border-gray-700">
              {[
                { value: "light",  icon: Sun,     label: "Light"  },
                { value: "dark",   icon: Moon,    label: "Dark"   },
                { value: "system", icon: Monitor, label: "Auto"   },
              ].map(({ value, icon: Icon, label }) => {
                const isActive = theme === value;
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    title={`Switch to ${label} mode`}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
                                transition-all duration-150 ${
                      isActive
                        ? "bg-white text-gray-900 shadow-sm border border-gray-200 dark:bg-emerald-600 dark:text-white dark:border-emerald-500"
                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Sign In */}
          <Link
            href="/auth/signin"
            className="text-sm font-medium text-emerald-600 dark:text-emerald-400
                       hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            Sign In
          </Link>

          {/* Get Started CTA */}
          <Link
            href="/auth/signup"
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white
                       bg-emerald-600 hover:bg-emerald-700
                       transition-colors shadow-sm"
          >
            Get Started Free
          </Link>
        </div>
      </div>
    </nav>
  );
}
