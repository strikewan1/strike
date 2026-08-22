"use client";

import { useMemo } from "react";
import { GarmentOverlay } from "./garment-overlay";
import type { BodyMeasurements } from "@/lib/body/proportions";
import { computeProportions } from "@/lib/body/proportions";
import type { LayerRole } from "@/lib/body/coordinates";
import { silhouettePath } from "@/lib/body/silhouette";
import { cn } from "@/lib/utils";

export interface MannequinOutfit {
  id: string;
  title: string;
  garments: Array<{
    role: LayerRole;
    garment_id: string;
    image_url: string | null;
  }>;
}

interface MannequinViewProps {
  measurements: BodyMeasurements;
  outfit?: MannequinOutfit | null;
  size?: number;
  className?: string;
  showGrid?: boolean;
}

/**
 * Renders the mannequin + outfit layers.
 * Pure SVG so it scales perfectly and is accessible.
 */
export function MannequinView({
  measurements,
  outfit = null,
  size = 300,
  className,
  showGrid = false,
}: MannequinViewProps) {
  const proportions = useMemo(
    () => computeProportions(measurements),
    [measurements],
  );

  const bodyPath = useMemo(() => {
    if (!proportions) return null;
    return silhouettePath({
      measurements,
      proportions,
      viewBoxWidth: 300,
      viewBoxHeight: 600,
    });
  }, [measurements, proportions]);

  if (!proportions || !bodyPath) return null;

  return (
    <div className={cn("inline-block bg-surface", className)}>
      <svg
        viewBox="0 0 300 600"
        width={size}
        height={size * 2}
        className="block"
        role="img"
        aria-label={outfit ? `Maniquí con ${outfit.title}` : "Maniquí"}
      >
        {showGrid && <ReferenceGrid />}

        <path
          d={bodyPath}
          fill="var(--surface-muted, #f4f4f3)"
          stroke="var(--border-strong, #d6d3d1)"
          strokeWidth="1.5"
        />

        {outfit?.garments.map((g) =>
          g.image_url ? (
            <GarmentOverlay
              key={g.garment_id}
              role={g.role}
              imageUrl={g.image_url}
              measurements={measurements}
              proportions={proportions}
              alt={g.role}
            />
          ) : null,
        )}
      </svg>
    </div>
  );
}

function ReferenceGrid() {
  return (
    <g opacity="0.3" stroke="var(--border, #e7e5e4)" strokeWidth="0.5">
      {[50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550].map((y) => (
        <line key={y} x1="0" x2="300" y1={y} y2={y} />
      ))}
      <line x1="150" x2="150" y1="0" y2="600" />
    </g>
  );
}
