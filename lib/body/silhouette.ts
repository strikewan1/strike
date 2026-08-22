// Generate SVG path data for a body silhouette in frontal view.
// All coordinates are in viewBox space (default 300×600).
// Y axis is inverted (0 at top).

import type { BodyProportions } from "./proportions";
import { effectiveHipWidth, effectiveShoulderWidth, type BodyMeasurements } from "./proportions";

export interface SilhouetteOptions {
  measurements: BodyMeasurements;
  proportions: BodyProportions;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
}

/**
 * Generate a parametric silhouette path representing the user's body
 * proportions in frontal view.
 *
 * Output is an SVG path "d" string for a single closed shape.
 * Coordinate system: top-left origin, viewBox is 300×600 (1:2 aspect).
 */
export function silhouettePath(opts: SilhouetteOptions): string {
  const W = opts.viewBoxWidth ?? 300;
  const H = opts.viewBoxHeight ?? 600;
  const p = opts.proportions;
  const m = opts.measurements;

  const cx = W / 2;

  // Vertical anchors (top → bottom)
  const headTop = 0;
  const chinY = H * p.head;
  const neckBaseY = chinY + H * p.neck * 0.6;
  const shoulderY = neckBaseY + H * p.neck * 0.4;
  const waistY = shoulderY + H * p.torso * 0.7;
  const hipY = shoulderY + H * p.torso;
  const kneeY = hipY + H * p.hip_to_knee;
  const ankleY = kneeY + H * p.knee_to_ankle;
  const crotchY = hipY + H * 0.04; // slight offset from hip line

  // Widths
  const shoulderHalf = effectiveShoulderWidth(m, p) / 2;
  const hipHalf = effectiveHipWidth(m, p) / 2;
  const waistHalf = hipHalf * 0.88; // waist slightly narrower than hip
  const chestHalf = hipHalf * 1.05;
  const neckHalf = shoulderHalf * 0.18;
  const headHalf = shoulderHalf * 0.45;
  const kneeHalf = hipHalf * 0.45;
  const ankleHalf = hipHalf * 0.35;

  // Convert real-cm widths to viewBox units.
  // Shoulder reference: ideal should be ~25% of height in cm,
  // at viewBox height H it should be ~30% of W for a balanced figure.
  const refShoulderViewbox = W * 0.30;
  const shoulderScale = refShoulderViewbox / shoulderHalf;
  const s = (cmWidth: number) => cmWidth * shoulderScale;

  // Arms hang from shoulders, slightly tapered
  const armStartY = shoulderY + H * 0.02;
  const armMidY = shoulderY + H * (p.shoulder_to_wrist * 0.5);
  const armEndY = shoulderY + H * p.shoulder_to_wrist;
  const armShoulderOffset = s(shoulderHalf) * 0.95;
  const wristOffset = s(shoulderHalf) * 0.55;

  // Path: head + neck + torso + arms + legs
  return [
    // Head
    `M ${cx - s(headHalf)} ${headTop + H * 0.06}`,
    `C ${cx - s(headHalf) * 1.05} ${headTop + H * 0.02}, ${cx - s(headHalf) * 0.8} ${headTop}, ${cx} ${headTop}`,
    `C ${cx + s(headHalf) * 0.8} ${headTop}, ${cx + s(headHalf) * 1.05} ${headTop + H * 0.02}, ${cx + s(headHalf)} ${headTop + H * 0.06}`,
    // Right side of head down to chin
    `C ${cx + s(headHalf)} ${chinY - H * 0.04}, ${cx + s(headHalf) * 0.95} ${chinY - H * 0.01}, ${cx + s(neckHalf) * 1.1} ${chinY + H * 0.01}`,
    // Neck (right)
    `L ${cx + s(neckHalf)} ${neckBaseY}`,
    // Right shoulder slope
    `L ${cx + armShoulderOffset} ${shoulderY}`,
    // Right arm: outer edge from shoulder to wrist
    `C ${cx + armShoulderOffset + s(shoulderHalf) * 0.05} ${armStartY + H * 0.05}, ${cx + wristOffset + s(shoulderHalf) * 0.08} ${armMidY}, ${cx + wristOffset} ${armEndY}`,
    // Right hand
    `L ${cx + wristOffset + s(shoulderHalf) * 0.04} ${armEndY + H * 0.015}`,
    `L ${cx + wristOffset - s(shoulderHalf) * 0.04} ${armEndY + H * 0.015}`,
    // Right inner arm back to torso
    `C ${cx + wristOffset - s(shoulderHalf) * 0.05} ${armMidY}, ${cx + s(chestHalf) * 0.85} ${waistY - H * 0.04}, ${cx + s(chestHalf)} ${waistY - H * 0.02}`,
    // Right waist taper
    `C ${cx + s(chestHalf) * 0.95} ${waistY + H * 0.02}, ${cx + s(waistHalf) * 1.05} ${hipY - H * 0.04}, ${cx + s(hipHalf)} ${hipY}`,
    // Right hip to knee (outer leg)
    `C ${cx + s(hipHalf)} ${hipY + H * 0.05}, ${cx + s(kneeHalf) * 1.05} ${kneeY - H * 0.04}, ${cx + s(kneeHalf)} ${kneeY}`,
    // Right knee to ankle
    `C ${cx + s(kneeHalf) * 0.95} ${kneeY + H * 0.08}, ${cx + s(ankleHalf) * 1.05} ${ankleY - H * 0.02}, ${cx + s(ankleHalf)} ${ankleY}`,
    // Bottom of right leg
    `L ${cx + s(ankleHalf) * 0.7} ${ankleY}`,
    // Crotch
    `L ${cx} ${crotchY}`,
    // Bottom of left leg
    `L ${cx - s(ankleHalf) * 0.7} ${ankleY}`,
    // Left ankle to knee
    `C ${cx - s(ankleHalf)} ${ankleY - H * 0.02}, ${cx - s(kneeHalf) * 0.95} ${kneeY + H * 0.08}, ${cx - s(kneeHalf)} ${kneeY}`,
    // Left knee to hip
    `C ${cx - s(kneeHalf) * 1.05} ${kneeY - H * 0.04}, ${cx - s(hipHalf)} ${hipY + H * 0.05}, ${cx - s(hipHalf)} ${hipY}`,
    // Left waist
    `C ${cx - s(waistHalf) * 1.05} ${hipY - H * 0.04}, ${cx - s(chestHalf) * 0.95} ${waistY + H * 0.02}, ${cx - s(chestHalf)} ${waistY - H * 0.02}`,
    // Left inner arm
    `C ${cx - wristOffset + s(shoulderHalf) * 0.05} ${armMidY}, ${cx - wristOffset - s(shoulderHalf) * 0.04} ${armEndY + H * 0.015}`,
    // Left hand
    `L ${cx - wristOffset - s(shoulderHalf) * 0.04} ${armEndY + H * 0.015}`,
    `L ${cx - wristOffset + s(shoulderHalf) * 0.04} ${armEndY + H * 0.015}`,
    // Left outer arm
    `C ${cx - wristOffset} ${armMidY}, ${cx - armShoulderOffset - s(shoulderHalf) * 0.05} ${armStartY + H * 0.05}, ${cx - armShoulderOffset} ${shoulderY}`,
    // Left shoulder back to neck
    `L ${cx - s(neckHalf)} ${neckBaseY}`,
    // Left neck
    `L ${cx - s(neckHalf) * 1.1} ${chinY + H * 0.01}`,
    // Left side of head
    `C ${cx - s(headHalf) * 0.95} ${chinY - H * 0.01}, ${cx - s(headHalf)} ${chinY - H * 0.04}, ${cx - s(headHalf)} ${headTop + H * 0.06}`,
    "Z",
  ].join(" ");
}

/**
 * Reference lines for layer visualization:
 * - Head, neck, shoulder, chest, waist, hip, knee, ankle
 * Returns y-coordinates as fraction of viewBox height.
 */
export function layerAnchors(p: BodyProportions): {
  head_top: number;
  chin: number;
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  knee: number;
  ankle: number;
} {
  return {
    head_top: 0,
    chin: p.head,
    shoulder: p.head + p.neck,
    chest: p.head + p.neck + p.torso * 0.45,
    waist: p.head + p.neck + p.torso * 0.7,
    hip: p.head + p.neck + p.torso,
    knee: p.head + p.neck + p.torso + p.hip_to_knee,
    ankle: p.head + p.neck + p.torso + p.hip_to_knee + p.knee_to_ankle,
  };
}
