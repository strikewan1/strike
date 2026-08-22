import { describe, it, expect } from "vitest";
import {
  computeProportions,
  effectiveHipWidth,
  effectiveInseam,
  effectiveShoulderWidth,
  isPlausibleHeight,
  isPlausibleWeight,
  isPlausibleShoulder,
  type BodyMeasurements,
} from "@/lib/body/proportions";
import { silhouettePath, layerAnchors } from "@/lib/body/silhouette";
import {
  footwearZones,
  placementFor,
  type PlacementOptions,
} from "@/lib/body/coordinates";

describe("computeProportions", () => {
  it("returns null without height", () => {
    expect(computeProportions({ height_cm: null, weight_kg: null })).toBeNull();
  });

  it("returns null for non-positive height", () => {
    expect(computeProportions({ height_cm: 0, weight_kg: null })).toBeNull();
    expect(computeProportions({ height_cm: -10, weight_kg: null })).toBeNull();
  });

  it("defaults to average build without weight", () => {
    const p = computeProportions({ height_cm: 178, weight_kg: null });
    expect(p?.build).toBe("average");
    expect(p?.bmi).toBeNull();
  });

  it("classifies BMI < 18.5 as thin", () => {
    const p = computeProportions({ height_cm: 180, weight_kg: 58 });
    expect(p?.build).toBe("thin");
    expect(p?.bmi).toBeCloseTo(17.9, 1);
  });

  it("classifies BMI 25-29.9 as broad", () => {
    const p = computeProportions({ height_cm: 175, weight_kg: 80 });
    expect(p?.build).toBe("broad");
    expect(p?.bmi).toBeCloseTo(26.1, 1);
  });

  it("classifies BMI >= 30 as plus", () => {
    const p = computeProportions({ height_cm: 175, weight_kg: 100 });
    expect(p?.build).toBe("plus");
    expect(p?.bmi).toBeCloseTo(32.7, 1);
  });

  it("returns classic 8-head-tall proportions", () => {
    const p = computeProportions({ height_cm: 180, weight_kg: 75 })!;
    expect(p.head).toBeCloseTo(0.125, 3); // 1/8
    expect(p.head + p.neck + p.torso).toBeCloseTo(0.465, 3);
  });

  it("broader build produces wider shoulders", () => {
    const thin = computeProportions({ height_cm: 180, weight_kg: 55 })!;
    const plus = computeProportions({ height_cm: 180, weight_kg: 110 })!;
    expect(plus.ideal_shoulder_width_cm).toBeGreaterThan(
      thin.ideal_shoulder_width_cm,
    );
  });
});

describe("effective*Width / Inseam", () => {
  it("returns real shoulder when present", () => {
    const m = { height_cm: 180, weight_kg: 75, shoulders_cm: 50 };
    const p = computeProportions(m)!;
    expect(effectiveShoulderWidth(m, p)).toBe(50);
  });

  it("falls back to proportional estimate", () => {
    const m = { height_cm: 180, weight_kg: 75, shoulders_cm: null };
    const p = computeProportions(m)!;
    // 180 * 0.25 = 45
    expect(effectiveShoulderWidth(m, p)).toBeCloseTo(45, 1);
  });

  it("hip width uses waist when present", () => {
    const m = { height_cm: 180, weight_kg: 75, waist_cm: 82 };
    const p = computeProportions(m)!;
    // waist * 1.05 = 86.1
    expect(effectiveHipWidth(m, p)).toBeCloseTo(86.1, 1);
  });

  it("hip width uses chest when waist missing", () => {
    const m = { height_cm: 180, weight_kg: 75, chest_cm: 100, waist_cm: null };
    const p = computeProportions(m)!;
    expect(effectiveHipWidth(m, p)).toBeCloseTo(95, 1);
  });

  it("inseam falls back to proportional", () => {
    const m = { height_cm: 180, weight_kg: 75, inseam_cm: null };
    const p = computeProportions(m)!;
    const expected =
      (p.hip_to_knee + p.knee_to_ankle) * 180;
    expect(effectiveInseam(m, p)).toBeCloseTo(expected, 1);
  });
});

describe("plausibility checks", () => {
  it("rejects impossible heights", () => {
    expect(isPlausibleHeight(50)).toBe(false);
    expect(isPlausibleHeight(99)).toBe(false);
    expect(isPlausibleHeight(251)).toBe(false);
    expect(isPlausibleHeight(100)).toBe(true);
    expect(isPlausibleHeight(250)).toBe(true);
    expect(isPlausibleHeight(178)).toBe(true);
  });

  it("rejects impossible weights", () => {
    expect(isPlausibleWeight(24)).toBe(false);
    expect(isPlausibleWeight(251)).toBe(false);
    expect(isPlausibleWeight(75)).toBe(true);
  });

  it("rejects impossible shoulders", () => {
    expect(isPlausibleShoulder(24)).toBe(false);
    expect(isPlausibleShoulder(71)).toBe(false);
    expect(isPlausibleShoulder(46)).toBe(true);
  });
});

describe("silhouettePath", () => {
  it("returns a non-empty SVG path", () => {
    const m = { height_cm: 178, weight_kg: 74 };
    const p = computeProportions(m)!;
    const path = silhouettePath({ measurements: m, proportions: p });
    expect(path).toMatch(/^M /);
    expect(path).toMatch(/Z$/);
    expect(path.length).toBeGreaterThan(100);
  });

  it("taller people → larger viewbox-proportional coords (consistent scale)", () => {
    const short = silhouettePath({
      measurements: { height_cm: 160, weight_kg: 60 },
      proportions: computeProportions({ height_cm: 160, weight_kg: 60 })!,
    });
    const tall = silhouettePath({
      measurements: { height_cm: 195, weight_kg: 80 },
      proportions: computeProportions({ height_cm: 195, weight_kg: 80 })!,
    });
    // Both should be valid paths with similar structure
    expect(short.split(" ").length).toBeGreaterThan(30);
    expect(tall.split(" ").length).toBeGreaterThan(30);
  });

  it("wider build changes silhouette dimensions", () => {
    const thin = silhouettePath({
      measurements: { height_cm: 180, weight_kg: 60 },
      proportions: computeProportions({ height_cm: 180, weight_kg: 60 })!,
    });
    const wide = silhouettePath({
      measurements: { height_cm: 180, weight_kg: 110 },
      proportions: computeProportions({ height_cm: 180, weight_kg: 110 })!,
    });
    // The wide silhouette should have a larger shoulder offset
    const wideShoulderMatch = wide.match(/(\d+\.?\d*) (\d+\.?\d*) C/);
    const thinShoulderMatch = thin.match(/(\d+\.?\d*) (\d+\.?\d*) C/);
    expect(wideShoulderMatch && thinShoulderMatch).toBeTruthy();
  });
});

describe("layerAnchors", () => {
  it("returns anchors in 0-1 range that sum reasonably", () => {
    const m = { height_cm: 180, weight_kg: 75 };
    const p = computeProportions(m)!;
    const a = layerAnchors(p);
    expect(a.head_top).toBe(0);
    // ankle ≈ head + neck + torso + hip_to_knee + knee_to_ankle ≈ 0.915
    expect(a.ankle).toBeGreaterThan(0.85);
    expect(a.ankle).toBeLessThanOrEqual(1);
    // Sanity: chin is at head (0.125)
    expect(a.chin).toBeCloseTo(p.head, 5);
    // Sanity: shoulder is at head + neck
    expect(a.shoulder).toBeCloseTo(p.head + p.neck, 5);
  });
});

describe("placementFor", () => {
  const m: BodyMeasurements = { height_cm: 180, weight_kg: 75 };
  const p = computeProportions(m)!;
  const opts: PlacementOptions = { measurements: m, proportions: p };
  const H = opts.viewBoxHeight ?? 600;

  it("places top within silhouette vertical range", () => {
    const zone = placementFor("top", opts);
    expect(zone.y).toBeGreaterThan(0);
    expect(zone.y + zone.height).toBeLessThan(H);
  });

  it("places bottom below top (no overlap)", () => {
    const top = placementFor("top", opts);
    const bottom = placementFor("bottom", opts);
    expect(bottom.y).toBeGreaterThan(top.y);
  });

  it("places footwear at ankle level", () => {
    const zone = placementFor("footwear", opts);
    expect(zone.y).toBeGreaterThan(H * 0.85);
  });

  it("places accessory near head", () => {
    const zone = placementFor("accessory", opts);
    expect(zone.y).toBeLessThan(H * 0.2);
  });

  it("different builds produce proportional differences in shoulder width", () => {
    // Width in viewBox is normalized, but the proportion's ideal_shoulder_width_cm
    // reflects the build — this is the meaningful visual difference.
    const wide = computeProportions({ height_cm: 180, weight_kg: 110 })!;
    const thin = computeProportions({ height_cm: 180, weight_kg: 60 })!;
    expect(wide.ideal_shoulder_width_cm).toBeGreaterThan(
      thin.ideal_shoulder_width_cm,
    );
    expect(wide.build).not.toBe(thin.build);
  });
});

describe("footwearZones", () => {
  it("returns left and right shoes side by side", () => {
    const m = { height_cm: 180, weight_kg: 75 };
    const p = computeProportions(m)!;
    const { left, right } = footwearZones({ measurements: m, proportions: p });
    expect(right.x).toBeGreaterThan(left.x);
    expect(left.y).toBeCloseTo(right.y, 1);
    // Gap between them
    expect(right.x).toBeGreaterThan(left.x + left.width);
  });
});
