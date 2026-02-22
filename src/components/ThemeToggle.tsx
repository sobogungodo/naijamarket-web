"use client";

// src/components/ThemeToggle.tsx
// Light/Dark mode toggle button

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-full h-9" />;

  const options = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "Auto" },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg" style={{ backgroundColor: "var(--terminal-surface)" }}>
      {options.map((opt) => {
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded text-xs font-medium transition-all ${
              isActive
                ? "bg-naija-green text-white shadow-sm"
                : "hover:opacity-80"
            }`}
            style={!isActive ? { color: "var(--text-muted)" } : undefined}
            title={opt.label}
          >
            <opt.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
