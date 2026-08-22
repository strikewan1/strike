"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { daysSince, cn } from "@/lib/utils";

interface Sneaker {
  id: string;
  subcategory: string | null;
  primary_color: string | null;
  secondary_colors: string[] | null;
  cleaned_image_url: string | null;
  brand: string | null;
  sneaker_model: string | null;
  sneaker_colorway: string | null;
  sneaker_silhouette: string | null;
  sneaker_prominence: "neutral" | "icon" | "statement" | null;
  wear_count: number;
  last_worn: string | null;
  created_at: string;
}

type Health = "fresh" | "warn" | "stale" | "never";

function healthFor(s: Sneaker): { tag: Health; days: number | null; message: string } {
  if (!s.last_worn) {
    return {
      tag: "never",
      days: null,
      message: "Nunca usada",
    };
  }
  const days = daysSince(s.last_worn);
  if (days > 60) {
    return { tag: "stale", days, message: `Sin usar hace ${days} días` };
  }
  if (days > 21) {
    return { tag: "warn", days, message: `${days} días sin usar` };
  }
  return { tag: "fresh", days, message: `Usada hace ${days} días` };
}

export function SneakerRotationView({ sneakers }: { sneakers: Sneaker[] }) {
  if (sneakers.length === 0) {
    return (
      <div className="flex-1 px-6 pb-6">
        <div className="border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">No tenés sneakers registradas</p>
          <p className="text-xs text-muted mt-1 mb-4">
            Empezá agregando tu par más usado.
          </p>
          <Link href="/add">
            <Button variant="outline" size="sm">
              Agregar sneaker
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Add health data
  const withHealth = sneakers.map((s) => ({ sneaker: s, ...healthFor(s) }));

  // Sort: never-worn first, then stale, warn, fresh
  const order: Record<Health, number> = {
    never: 0,
    stale: 1,
    warn: 2,
    fresh: 3,
  };
  withHealth.sort(
    (a, b) => order[a.tag] - order[b.tag] || (b.days ?? 0) - (a.days ?? 0),
  );

  // Aggregate stats
  const totalWears = sneakers.reduce((sum, s) => sum + s.wear_count, 0);
  const neverWorn = sneakers.filter((s) => !s.last_worn).length;
  const stale = sneakers.filter((s) => healthFor(s).tag === "stale").length;
  const topUsed = [...sneakers].sort((a, b) => b.wear_count - a.wear_count).slice(0, 3);

  // Recommendation
  const rec = (() => {
    const neverUsed = withHealth.find((w) => w.tag === "never");
    if (neverUsed) return neverUsed;
    const stalePick = withHealth.find((w) => w.tag === "stale");
    if (stalePick) return stalePick;
    return null;
  })();

  return (
    <div className="flex-1 px-6 pb-6 space-y-6">
      {/* Stats */}
      <section className="grid grid-cols-3 gap-2">
        <Stat label="Pares" value={sneakers.length.toString()} />
        <Stat label="Usos totales" value={totalWears.toString()} />
        <Stat
          label="Sin usar"
          value={neverWorn.toString()}
          warning={neverWorn > 0}
        />
      </section>

      {/* Recommendation */}
      {rec && (
        <section className="border border-foreground bg-foreground text-background p-4">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-70 mb-1">
            Recomendación
          </p>
          <p className="text-sm">
            {rec.tag === "never"
              ? `Probá hoy tus ${rec.sneaker.sneaker_model ?? rec.sneaker.subcategory ?? "sneakers"} — nunca salieron.`
              : `Hace ${rec.days} días que no usás tus ${rec.sneaker.sneaker_model ?? rec.sneaker.subcategory ?? "sneakers"}. Hoy podrían ser protagonistas.`}
          </p>
          <Link
            href={`/outfits/build?sneaker=${rec.sneaker.id}`}
            className="mt-3 inline-block text-xs font-medium uppercase tracking-wider underline-offset-4 hover:underline"
          >
            Construir outfit →
          </Link>
        </section>
      )}

      {stale > 0 && rec?.tag !== "stale" && (
        <p className="text-xs text-warning">
          {stale} {stale === 1 ? "par lleva" : "pares llevan"} más de 60 días sin
          usarse. Considerá rotarlos esta semana.
        </p>
      )}

      {/* Top used */}
      {topUsed.length > 0 && topUsed[0].wear_count > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
            Más usados
          </p>
          <ul className="space-y-2">
            {topUsed.map((s, i) => (
              <li
                key={s.id}
                className="border border-border bg-surface p-3 flex items-center gap-3"
              >
                <span className="text-2xl font-medium tracking-tight text-muted w-6">
                  {i + 1}
                </span>
                <div className="h-12 w-12 bg-surface-muted shrink-0 overflow-hidden">
                  {s.cleaned_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.cleaned_image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {s.sneaker_model ?? s.subcategory ?? "Sneaker"}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wider">
                    {s.sneaker_colorway ?? s.primary_color ?? "—"}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {s.wear_count}×
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Full rotation list */}
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
          Toda la rotación
        </p>
        <ul className="border border-border bg-surface divide-y divide-border">
          {withHealth.map(({ sneaker: s, tag, message }) => (
            <li
              key={s.id}
              className="p-3 flex items-center gap-3"
            >
              <div className="h-12 w-12 bg-surface-muted shrink-0 overflow-hidden">
                {s.cleaned_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.cleaned_image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {s.sneaker_model ?? s.subcategory ?? "Sneaker"}
                </p>
                <p className="text-[10px] text-muted uppercase tracking-wider truncate">
                  {s.brand ? `${s.brand} · ` : ""}
                  {s.sneaker_colorway ?? s.primary_color ?? "—"}
                </p>
                <p
                  className={cn(
                    "text-xs mt-0.5",
                    tag === "stale" && "text-warning",
                    tag === "never" && "text-muted",
                  )}
                >
                  {message}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{s.wear_count}×</p>
                <p className="text-[10px] text-muted uppercase tracking-wider">
                  {s.sneaker_prominence ?? "—"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="border border-border bg-surface p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={cn(
          "text-2xl font-medium tracking-tight mt-1",
          warning && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}
