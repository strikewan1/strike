import { describe, it, expect } from "vitest";
import { cn, formatDate, daysSince } from "@/lib/utils";

describe("cn", () => {
  it("merges classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });
});

describe("formatDate", () => {
  it("formats ISO strings in Spanish", () => {
    const result = formatDate("2025-01-15");
    expect(result).toMatch(/ene/i);
    expect(result).toMatch(/2025/);
  });

  it("handles Date objects", () => {
    expect(formatDate(new Date("2025-06-01"))).toMatch(/2025/);
  });

  it("returns em-dash for null/undefined", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });
});

describe("daysSince", () => {
  it("returns 0 for today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(daysSince(today)).toBe(0);
  });

  it("returns correct day count for past dates", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect(daysSince(tenDaysAgo)).toBe(10);
  });

  it("returns 0 for null", () => {
    expect(daysSince(null)).toBe(0);
  });
});
