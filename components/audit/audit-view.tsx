"use client";

import { useMemo } from "react";
import { daysSince, cn } from "@/lib/utils";

interface GarmentAudit {
  id: string;
  kind: string;
  category: string;
  subcategory: string | null;
  primary_color: string | null;
  fit: string | null;
  cleaned_image_url: string | null;
  wear_count: number;
  last_worn: string | null;
  style_tags: string[];
  wardrobe_status: string;
  brand: string | null;
}

type AuditBucket = "core" | "useful" | "unused" | "question" | "duplicate";

interface ScoredGarment extends GarmentAudit {
  bucket: AuditBucket;
  reason: string;
}

const STYLE_DNA_TAGS = [
  "amekaji",
  "cityboy",
  "ivy",
  "workwear",
  "streetwear",
  "creative_executive",
  "minimal",
  "military",
];

function scoreGarments(garments: GarmentAudit[]): {
  core: ScoredGarment[];
  useful: ScoredGarment[];
  unused: ScoredGarment[];
  question: ScoredGarment[];
  duplicate: ScoredGarment[];
} {
  const result = {
    core: [] as ScoredGarment[],
    useful: [] as ScoredGarment[],
    unused: [] as ScoredGarment[],
    question: [] as ScoredGarment[],
    duplicate: [] as ScoredGarment[],
  };

  // Group by signature for duplicate detection
  const bySignature: Record<string, GarmentAudit[]> = {};
  for (const g of garments) {
    const sig = `${g.category}|${g.subcategory}|${g.primary_color}|${g.fit}`;
    if (!bySignature[sig]) bySignature[sig] = [];
    bySignature[sig].push(g);
  }

  // Items that have a signature with 3+ similar pieces are flagged as duplicates
  const duplicateIds = new Set<string>();
  for (const sig in bySignature) {
    const group = bySignature[sig];
    if (group.length >= 3) {
      // Keep the most-used as original; rest are duplicates
      const sorted = [...group].sort((a, b) => b.wear_count - a.wear_count);
      for (let i = 1; i < sorted.length; i++) {
        duplicateIds.add(sorted[i].id);
      }
    }
  }

  for (const g of garments) {
    if (duplicateIds.has(g.id)) {
      result.duplicate.push({
        ...g,
        bucket: "duplicate",
        reason: `Tenés ${bySignature[`${g.category}|${g.subcategory}|${g.primary_color}|${g.fit}`].length} piezas muy similares`,
      });
      continue;
    }

    const tagMatch = g.style_tags.some((t) =>
      STYLE_DNA_TAGS.includes(t.toLowerCase()),
    );
    const daysUnused = g.last_worn ? daysSince(g.last_worn) : 9999;

    // CORE: frequently worn + Style DNA match + favorite or status
    if (g.wear_count >= 3 && (tagMatch || g.style_tags.length >= 3)) {
      result.core.push({
        ...g,
        bucket: "core",
        reason: `Usada ${g.wear_count} veces · coincide con tu Style DNA`,
      });
      continue;
    }

    // UNUSED: never worn or 90+ days
    if (g.wear_count === 0 || daysUnused > 90) {
      const reason =
        g.wear_count === 0
          ? "Nunca usada. ¿Realmente la querés?"
          : `Sin usar hace ${daysUnused} días`;
      result.unused.push({ ...g, bucket: "unused", reason });
      continue;
    }

    // QUESTION: doesn't match Style DNA + rarely worn
    if (!tagMatch && g.wear_count < 2) {
      result.question.push({
        ...g,
        bucket: "question",
        reason: `No coincide con tu Style DNA actual. Usada solo ${g.wear_count} ${g.wear_count === 1 ? "vez" : "veces"}.`,
      });
      continue;
    }

    // USEFUL: default
    result.useful.push({
      ...g,
      bucket: "useful",
      reason: "Funciona y agrega variedad",
    });
  }

  // Sort each bucket
  const sortBy = (a: ScoredGarment, b: ScoredGarment) =>
    b.wear_count - a.wear_count;

  result.core.sort(sortBy);
  result.useful.sort(sortBy);
  result.unused.sort(sortBy);
  result.question.sort(sortBy);
  result.duplicate.sort(sortBy);

  return result;
}

export function AuditView({ garments }: { garments: GarmentAudit[] }) {
  const buckets = useMemo(() => scoreGarments(garments), [garments]);

  const sections: Array<{
    key: keyof typeof buckets;
    title: string;
    description: string;
    accent: string;
  }> = [
    {
      key: "core",
      title: "CORE",
      description: "Tus piezas esenciales. Las que más te representan.",
      accent: "text-foreground",
    },
    {
      key: "useful",
      title: "USEFUL",
      description: "Funcionan y suman.",
      accent: "text-foreground",
    },
    {
      key: "question",
      title: "QUESTION",
      description: "Problemas de fit, combinación o coherencia con tu estilo.",
      accent: "text-warning",
    },
    {
      key: "unused",
      title: "UNUSED",
      description: "Sin uso reciente. ¿Seguirían en tu closet?",
      accent: "text-muted",
    },
    {
      key: "duplicate",
      title: "DUPLICATE",
      description: "Funciones cubiertas por piezas similares.",
      accent: "text-warning",
    },
  ];

  return (
    <div className="flex-1 px-6 pb-6 space-y-8">
      {sections.map((section) => {
        const items = buckets[section.key];
        if (items.length === 0) return null;
        return (
          <section key={section.key}>
            <div className="mb-3">
              <h2
                className={cn(
                  "text-sm font-medium tracking-tight",
                  section.accent,
                )}
              >
                {section.title}{" "}
                <span className="text-muted font-normal">({items.length})</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">{section.description}</p>
            </div>
            <ul className="space-y-2">
              {items.map((g) => (
                <li
                  key={g.id}
                  className="border border-border bg-surface p-3 flex gap-3"
                >
                  <div className="h-14 w-14 bg-surface-muted shrink-0 overflow-hidden">
                    {g.cleaned_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.cleaned_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {g.subcategory?.replace(/_/g, " ") ?? g.category}
                    </p>
                    <p className="text-[10px] text-muted uppercase tracking-wider">
                      {g.brand ?? "—"} · {g.primary_color ?? "—"}
                    </p>
                    <p className="text-xs mt-1 text-muted italic">
                      {g.reason}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
