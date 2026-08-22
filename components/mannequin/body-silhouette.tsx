import { silhouettePath } from "@/lib/body/silhouette";
import type { BodyMeasurements } from "@/lib/body/proportions";
import { computeProportions } from "@/lib/body/proportions";

interface BodySilhouetteProps {
  measurements: BodyMeasurements;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Renders the parametric SVG silhouette of the user's body.
 * Pure function of measurements — same input always produces same output.
 */
export function BodySilhouette({
  measurements,
  width = 300,
  height = 600,
  className,
}: BodySilhouetteProps) {
  const proportions = computeProportions(measurements);
  if (!proportions) return null;

  const path = silhouettePath({
    measurements,
    proportions,
    viewBoxWidth: 300,
    viewBoxHeight: 600,
  });

  return (
    <svg
      viewBox="0 0 300 600"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Silueta del cuerpo"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={path}
        fill="var(--surface-muted, #f4f4f3)"
        stroke="var(--border-strong, #d6d3d1)"
        strokeWidth="1.5"
      />
    </svg>
  );
}
