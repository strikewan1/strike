import { describe, it, expect } from "vitest";
import {
  colorCompatibility,
  fitBalance,
  formalityScore,
  rotationPenalty,
  summarizeForLLM,
} from "@/lib/outfit-engine/rules";

describe("colorCompatibility", () => {
  it("returns 0.7 for identical colors", () => {
    expect(colorCompatibility("navy", "navy")).toBe(0.7);
  });

  it("returns 0.85 for non-complementary neutral pairs", () => {
    // white is in COMPLEMENTARY with many things, so we need a non-complementary case
    expect(colorCompatibility("white", "mustard")).toBe(0.85);
  });

  it("returns 1.0 for complementary pairs", () => {
    expect(colorCompatibility("navy", "white")).toBe(1.0);
    expect(colorCompatibility("olive", "white")).toBe(1.0);
  });

  it("returns 0.9 for earth tone pairs (both exclusive to EARTH)", () => {
    // rust and burgundy are in EARTH but not NEUTRAL palette
    expect(colorCompatibility("rust", "burgundy")).toBe(0.9);
    expect(colorCompatibility("mustard", "rust")).toBe(0.9);
  });

  it("returns 0.5 for unknown / non-matching colors", () => {
    expect(colorCompatibility("purple", "orange")).toBe(0.5);
  });

  it("handles null gracefully", () => {
    expect(colorCompatibility(null, "white")).toBe(0.5);
    expect(colorCompatibility("white", null)).toBe(0.5);
    expect(colorCompatibility(null, null)).toBe(0.5);
  });

  it("is case-insensitive", () => {
    expect(colorCompatibility("NAVY", "white")).toBe(1.0);
  });
});

describe("fitBalance", () => {
  it("scores slim top + relaxed bottom as balanced (1.0)", () => {
    expect(fitBalance("slim", "straight")).toBe(1.0);
    expect(fitBalance("slim", "relaxed")).toBe(1.0);
  });

  it("scores relaxed top + slim bottom as 0.9", () => {
    expect(fitBalance("regular", "slim")).toBe(0.9);
  });

  it("scores both relaxed as 0.85", () => {
    expect(fitBalance("regular", "regular")).toBe(0.85);
  });

  it("scores oversized top + slim bottom as 0.95", () => {
    expect(fitBalance("oversized", "slim")).toBe(0.95);
  });

  it("returns 0.6 with missing values", () => {
    expect(fitBalance(null, "straight")).toBe(0.6);
    expect(fitBalance("slim", null)).toBe(0.6);
  });

  it("returns 0.6 for unknown combos", () => {
    expect(fitBalance("weird", "stuff")).toBe(0.6);
  });
});

describe("formalityScore", () => {
  it("returns 0 for empty items", () => {
    expect(formalityScore([])).toBe(0);
  });

  it("returns near-1 for low variance formality", () => {
    const items = [
      { formality: 2 },
      { formality: 3 },
      { formality: 2 },
    ] as never;
    // variance / 4 is small but non-zero
    expect(formalityScore(items)).toBeGreaterThan(0.9);
  });

  it("returns exactly 1 for identical formality values", () => {
    const items = [
      { formality: 3 },
      { formality: 3 },
      { formality: 3 },
    ] as never;
    expect(formalityScore(items)).toBe(1);
  });

  it("penalizes high variance", () => {
    const items = [
      { formality: 0 },
      { formality: 5 },
    ] as never;
    expect(formalityScore(items)).toBeLessThan(0.5);
  });

  it("ignores items without formality", () => {
    const items = [
      { formality: 2 },
      { formality: null },
      { formality: 3 },
    ] as never;
    expect(formalityScore(items)).toBeGreaterThan(0.5);
  });
});

describe("rotationPenalty", () => {
  it("encourages never-worn items (penalty 0.1)", () => {
    const item = {
      wear_count: 0,
      last_worn: null,
    } as never;
    expect(rotationPenalty(item)).toBe(0.1);
  });

  it("penalizes recently worn items", () => {
    const today = new Date().toISOString().slice(0, 10);
    const item = {
      wear_count: 5,
      last_worn: today,
    } as never;
    expect(rotationPenalty(item)).toBe(0.5);
  });

  it("returns 0 for items worn >7 days ago", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const item = {
      wear_count: 5,
      last_worn: tenDaysAgo,
    } as never;
    expect(rotationPenalty(item)).toBe(0);
  });
});

describe("summarizeForLLM", () => {
  it("projects the relevant fields only", () => {
    const items = [
      {
        id: "a",
        category: "top",
        subcategory: "heavyweight_tee",
        fit: "boxy",
        primary_color: "white",
        secondary_colors: [],
        formality: 1,
        style_tags: ["amekaji"],
        sneaker_prominence: null,
        wear_count: 3,
        last_worn: "2025-01-01",
      },
    ] as never;

    const summary = summarizeForLLM(items);
    expect(summary).toEqual([
      {
        id: "a",
        category: "top",
        subcategory: "heavyweight_tee",
        fit: "boxy",
        color: "white",
        secondary: [],
        formality: 1,
        tags: ["amekaji"],
        prominence: null,
        wear_count: 3,
        last_worn: "2025-01-01",
      },
    ]);
  });
});
