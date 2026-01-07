import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import numeral from "numeral";
import { format, formatDistanceToNow, parseISO } from "date-fns";

// ============================================================================
// CLASSNAME UTILITIES
// ============================================================================

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format number as Nigerian Naira currency
 */
export function formatNaira(value: number | null | undefined, showSymbol = true): string {
  if (value == null || isNaN(value)) return showSymbol ? "₦0" : "0";
  const formatted = numeral(value).format("0,0.00");
  return showSymbol ? `₦${formatted}` : formatted;
}

/**
 * Format number with compact notation (e.g., 1.2K, 3.5M)
 */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "0";
  if (value >= 1_000_000_000) return numeral(value / 1_000_000_000).format("0.0") + "B";
  if (value >= 1_000_000) return numeral(value / 1_000_000).format("0.0") + "M";
  if (value >= 1_000) return numeral(value / 1_000).format("0.0") + "K";
  return numeral(value).format("0,0");
}

/**
 * Format percentage change with sign and color class
 */
export function formatPercentChange(value: number | null | undefined): {
  text: string;
  color: string;
  direction: "up" | "down" | "neutral";
} {
  if (value == null || isNaN(value)) {
    return { text: "0.00%", color: "text-gray-500", direction: "neutral" };
  }
  
  const formatted = `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  
  if (value > 0) {
    return { text: formatted, color: "text-price-up", direction: "up" };
  } else if (value < 0) {
    return { text: formatted, color: "text-price-down", direction: "down" };
  }
  return { text: "0.00%", color: "text-gray-500", direction: "neutral" };
}

/**
 * Format number with specified decimal places
 */
export function formatNumber(
  value: number | null | undefined,
  decimals = 2
): string {
  if (value == null || isNaN(value)) return "0";
  return numeral(value).format(`0,0.${"0".repeat(decimals)}`);
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format date for display
 */
export function formatDate(
  date: Date | string | null | undefined,
  formatStr = "MMM d, yyyy"
): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

/**
 * Format date and time for display
 */
export function formatDateTime(
  date: Date | string | null | undefined,
  formatStr = "MMM d, yyyy HH:mm"
): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Format time only (e.g., "14:30")
 */
export function formatTime(
  date: Date | string | null | undefined,
  formatStr = "HH:mm"
): string {
  if (!date) return "-";
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return format(dateObj, formatStr);
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

/**
 * Capitalize first letter of each word
 */
export function titleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Convert string to slug
 */
export function slugify(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

/**
 * Generate random ID
 */
export function generateId(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Nigerian phone number
 */
export function isValidNigerianPhone(phone: string): boolean {
  // Matches: +234XXXXXXXXXX, 234XXXXXXXXXX, 0XXXXXXXXXX
  const phoneRegex = /^(\+?234|0)[789]\d{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

/**
 * Format Nigerian phone number to international format
 */
export function formatNigerianPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("234")) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith("0")) {
    return `+234${cleaned.slice(1)}`;
  }
  return `+234${cleaned}`;
}

// ============================================================================
// PRICE TREND UTILITIES
// ============================================================================

/**
 * Get trend indicator from price change
 */
export function getTrendIndicator(change: number | null | undefined): {
  icon: "↑" | "↓" | "→";
  color: string;
  label: string;
} {
  if (change == null || Math.abs(change) < 0.01) {
    return { icon: "→", color: "text-gray-500", label: "Unchanged" };
  }
  if (change > 0) {
    return { icon: "↑", color: "text-price-up", label: "Increased" };
  }
  return { icon: "↓", color: "text-price-down", label: "Decreased" };
}

/**
 * Calculate price change between two values
 */
export function calculatePriceChange(
  current: number,
  previous: number
): { amount: number; percent: number } {
  const amount = current - previous;
  const percent = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
  return { amount, percent };
}

// ============================================================================
// URL & QUERY UTILITIES
// ============================================================================

/**
 * Build URL with query parameters
 */
export function buildUrl(base: string, params: Record<string, unknown>): string {
  const url = new URL(base, window?.location?.origin || "http://localhost:3000");
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

/**
 * Parse query parameters from URL
 */
export function parseQueryParams(search: string): Record<string, string> {
  const params = new URLSearchParams(search);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// ============================================================================
// DEBOUNCE & THROTTLE
// ============================================================================

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================================
// LOCAL STORAGE UTILITIES
// ============================================================================

/**
 * Get item from localStorage with JSON parsing
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set item in localStorage with JSON stringify
 */
export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Error setting localStorage:", error);
  }
}

/**
 * Remove item from localStorage
 */
export function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Error removing from localStorage:", error);
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
    if (typeof err.error === "string") return err.error;
  }
  return "An unexpected error occurred";
}

// ============================================================================
// ARRAY UTILITIES
// ============================================================================

/**
 * Group array items by key
 */
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    return {
      ...groups,
      [groupKey]: [...(groups[groupKey] || []), item],
    };
  }, {} as Record<string, T[]>);
}

/**
 * Sort array by key
 */
export function sortBy<T>(
  array: T[],
  key: keyof T,
  direction: "asc" | "desc" = "asc"
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

/**
 * Remove duplicates from array by key
 */
export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return array.filter((item) => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}
