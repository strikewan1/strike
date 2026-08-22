// Pure calculation: convert body measurements → proportional lengths.
// All lengths are in the same unit as `height_cm` (default: cm).
// Real measurements (when available) override the proportional estimates.

export type Build = "thin" | "average" | "broad" | "plus";

export interface BodyMeasurements {
  height_cm: number | null;
  weight_kg: number | null;
  shoulders_cm?: number | null;
  chest_cm?: number | null;
  waist_cm?: number | null;
  inseam_cm?: number | null;
}

export interface BodyProportions {
  // Fractions of total height, summing to ~1.0
  head: number;
  neck: number;
  torso: number; // shoulders to hips
  hip_to_knee: number;
  knee_to_ankle: number;
  shoulder_to_wrist: number; // arm
  // Width factors (multipliers of ideal shoulder width)
  build: Build;
  shoulder_width_factor: number;
  torso_width_factor: number;
  hip_width_factor: number;
  // Average ideal in cm (for visualization reference)
  ideal_shoulder_width_cm: number;
  ideal_hip_width_cm: number;
  // BMI for reference
  bmi: number | null;
}

// Reference proportions (averaged for adult male, height-independent).
// Source: classical figure-drawing canon (Loomis/Richter)
const REFERENCE = {
  head: 0.125, // head fits ~8x in body
  neck: 0.04,
  torso: 0.30,
  hipToKnee: 0.225,
  kneeToAnkle: 0.225,
  shoulderToWrist: 0.45,
};

/**
 * Compute proportions from measurements.
 * If real measurements are missing, falls back to proportional estimates
 * from height + BMI-derived build factor.
 */
export function computeProportions(m: BodyMeasurements): BodyProportions | null {
  if (!m.height_cm || m.height_cm <= 0) return null;

  const bmi = m.weight_kg && m.height_cm
    ? m.weight_kg / Math.pow(m.height_cm / 100, 2)
    : null;

  const build = bmiToBuild(bmi);

  // Build factors control how wide the body is relative to "average"
  const factor = BUILD_FACTORS[build];
  // Average adult male shoulder ≈ 25% of height
  const ideal_shoulder = m.height_cm * 0.25 * factor.shoulder;
  const ideal_hip = m.height_cm * 0.18 * factor.hip;

  return {
    head: REFERENCE.head,
    neck: REFERENCE.neck,
    torso: REFERENCE.torso,
    hip_to_knee: REFERENCE.hipToKnee,
    knee_to_ankle: REFERENCE.kneeToAnkle,
    shoulder_to_wrist: REFERENCE.shoulderToWrist,
    build,
    shoulder_width_factor: factor.shoulder,
    torso_width_factor: factor.torso,
    hip_width_factor: factor.hip,
    ideal_shoulder_width_cm: ideal_shoulder,
    ideal_hip_width_cm: ideal_hip,
    bmi,
  };
}

/**
 * Effective shoulder width — uses real measurement if available, otherwise estimate.
 */
export function effectiveShoulderWidth(
  m: BodyMeasurements,
  p: BodyProportions,
): number {
  if (m.shoulders_cm && m.shoulders_cm > 0) return m.shoulders_cm;
  return p.ideal_shoulder_width_cm;
}

/**
 * Effective hip width — chest/waist can substitute.
 */
export function effectiveHipWidth(
  m: BodyMeasurements,
  p: BodyProportions,
): number {
  if (m.waist_cm && m.waist_cm > 0) {
    // waist ≈ hip when no hip measurement
    return m.waist_cm * 1.05;
  }
  if (m.chest_cm && m.chest_cm > 0) {
    return m.chest_cm * 0.95;
  }
  return p.ideal_hip_width_cm;
}

export function effectiveInseam(
  m: BodyMeasurements,
  p: BodyProportions,
): number {
  if (m.inseam_cm && m.inseam_cm > 0) return m.inseam_cm;
  return (p.hip_to_knee + p.knee_to_ankle) * m.height_cm!;
}

function bmiToBuild(bmi: number | null): Build {
  if (bmi === null) return "average";
  if (bmi < 18.5) return "thin";
  if (bmi < 25) return "average";
  if (bmi < 30) return "broad";
  return "plus";
}

const BUILD_FACTORS: Record<
  Build,
  { shoulder: number; torso: number; hip: number }
> = {
  thin: { shoulder: 0.9, torso: 0.8, hip: 0.85 },
  average: { shoulder: 1.0, torso: 1.0, hip: 1.0 },
  broad: { shoulder: 1.12, torso: 1.18, hip: 1.08 },
  plus: { shoulder: 1.22, torso: 1.32, hip: 1.18 },
};

/**
 * Sanity-check a measurement value (reject implausible outliers).
 */
export function isPlausibleHeight(cm: number): boolean {
  return cm >= 100 && cm <= 250;
}

export function isPlausibleWeight(kg: number): boolean {
  return kg >= 25 && kg <= 250;
}

export function isPlausibleShoulder(cm: number): boolean {
  return cm >= 25 && cm <= 70;
}
