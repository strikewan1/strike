// Coordinates for placing garment images on the mannequin.
// Single source of truth: any render layer (SVG, Canvas, WebGL, AI) reads
// from here. Tomorrow's virtual try-on just consumes these zones.

import type { BodyProportions } from "./proportions";
import {
  effectiveHipWidth,
  effectiveShoulderWidth,
  type BodyMeasurements,
} from "./proportions";

export type LayerRole = "top" | "bottom" | "layer" | "footwear" | "accessory";

export interface PlacementZone {
  // All in viewBox units (default 300×600)
  x: number; // top-left x
  y: number; // top-left y
  width: number;
  height: number;
}

export interface PlacementOptions {
  measurements: BodyMeasurements;
  proportions: BodyProportions;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
}

export function placementFor(
  role: LayerRole,
  opts: PlacementOptions,
): PlacementZone {
  const W = opts.viewBoxWidth ?? 300;
  const H = opts.viewBoxHeight ?? 600;
  const p = opts.proportions;
  const m = opts.measurements;

  const refShoulderViewbox = W * 0.30;
  const shoulderHalf = effectiveShoulderWidth(m, p) / 2;
  const shoulderScale = refShoulderViewbox / shoulderHalf;

  const s = (cm: number) => cm * shoulderScale;

  const shoulderY = H * (p.head + p.neck);
  const torsoBottomY = shoulderY + H * p.torso;

  switch (role) {
    case "top": {
      const width = s(shoulderHalf) * 2.1; // ~10% overhang
      const height = H * (p.torso * 0.55 + 0.02);
      return {
        x: (W - width) / 2,
        y: shoulderY - H * 0.02,
        width,
        height,
      };
    }
    case "bottom": {
      const width = s(effectiveHipWidth(m, p) / 2) * 2.05;
      const height = H * (p.torso * 0.45 + p.hip_to_knee + p.knee_to_ankle - 0.02);
      return {
        x: (W - width) / 2,
        y: torsoBottomY + H * 0.02,
        width,
        height,
      };
    }
    case "layer": {
      // Layered jacket — slightly wider than top, slightly longer
      const width = s(shoulderHalf) * 2.2;
      const height = H * (p.torso + 0.05);
      return {
        x: (W - width) / 2,
        y: shoulderY - H * 0.04,
        width,
        height,
      };
    }
    case "footwear": {
      // Positioned at the ankle level, two shoes side by side
      const shoeWidth = s(shoulderHalf) * 0.7;
      const shoeHeight = H * 0.06;
      const ankleY = torsoBottomY + H * (p.hip_to_knee + p.knee_to_ankle);
      const gap = shoeWidth * 0.2;
      // We return the union box — individual shoes handled by renderer
      return {
        x: W / 2 - shoeWidth - gap / 2,
        y: ankleY - shoeHeight * 0.4,
        width: shoeWidth * 2 + gap,
        height: shoeHeight,
      };
    }
    case "accessory": {
      // Head region for hats/glasses; small zone near top
      return {
        x: W * 0.2,
        y: H * 0.02,
        width: W * 0.6,
        height: H * 0.12,
      };
    }
  }
}

/**
 * For footwear, returns separate zones for left and right shoes
 * so each can use its own image.
 */
export function footwearZones(
  opts: PlacementOptions,
): { left: PlacementZone; right: PlacementZone } {
  const W = opts.viewBoxWidth ?? 300;
  const p = opts.proportions;
  const m = opts.measurements;
  const H = opts.viewBoxHeight ?? 600;

  const refShoulderViewbox = W * 0.30;
  const shoulderHalf = effectiveShoulderWidth(m, p) / 2;
  const shoulderScale = refShoulderViewbox / shoulderHalf;
  const s = (cm: number) => cm * shoulderScale;

  const shoeWidth = s(shoulderHalf) * 0.7;
  const shoeHeight = H * 0.06;
  const ankleY =
    H * (p.head + p.neck + p.torso + p.hip_to_knee + p.knee_to_ankle);
  const gap = shoeWidth * 0.2;
  const y = ankleY - shoeHeight * 0.4;

  return {
    left: {
      x: W / 2 - shoeWidth - gap / 2,
      y,
      width: shoeWidth,
      height: shoeHeight,
    },
    right: {
      x: W / 2 + gap / 2,
      y,
      width: shoeWidth,
      height: shoeHeight,
    },
  };
}
