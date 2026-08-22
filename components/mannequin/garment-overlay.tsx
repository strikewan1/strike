import type { LayerRole } from "@/lib/body/coordinates";
import { footwearZones, placementFor } from "@/lib/body/coordinates";
import type { BodyMeasurements, BodyProportions } from "@/lib/body/proportions";

interface GarmentOverlayProps {
  role: LayerRole;
  imageUrl: string;
  measurements: BodyMeasurements;
  proportions: BodyProportions;
  alt?: string;
}

/**
 * Renders a garment image positioned on the body silhouette.
 * Coordinates come from `lib/body/coordinates.ts` — same source of truth
 * for any future render layer (Canvas, WebGL, AI try-on).
 */
export function GarmentOverlay({
  role,
  imageUrl,
  measurements,
  proportions,
  alt,
}: GarmentOverlayProps) {
  const W = 300;
  const H = 600;
  const opts = { measurements, proportions, viewBoxWidth: W, viewBoxHeight: H };

  if (role === "footwear") {
    // Two shoes, one image rendered into each zone (mirrored layout)
    const { left, right } = footwearZones(opts);
    return (
      <g>
        <image
          href={imageUrl}
          x={left.x}
          y={left.y}
          width={left.width}
          height={left.height}
          preserveAspectRatio="xMidYMid meet"
          aria-label={alt}
        />
        <image
          href={imageUrl}
          x={right.x}
          y={right.y}
          width={right.width}
          height={right.height}
          preserveAspectRatio="xMidYMid meet"
          aria-label={alt}
        />
      </g>
    );
  }

  const zone = placementFor(role, opts);
  return (
    <image
      href={imageUrl}
      x={zone.x}
      y={zone.y}
      width={zone.width}
      height={zone.height}
      preserveAspectRatio="xMidYMid slice"
      aria-label={alt}
    />
  );
}
