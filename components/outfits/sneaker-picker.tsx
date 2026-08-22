"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

interface Sneaker {
  id: string;
  subcategory: string | null;
  primary_color: string | null;
  cleaned_image_url: string | null;
  brand: string | null;
  sneaker_model: string | null;
  sneaker_colorway: string | null;
  sneaker_silhouette: string | null;
  sneaker_prominence: "neutral" | "icon" | "statement" | null;
}

const OCCASIONS = [
  { value: "trabajo", label: "Trabajo" },
  { value: "oficina_relajada", label: "Oficina relajada" },
  { value: "cena", label: "Cena" },
  { value: "cita", label: "Cita" },
  { value: "salir_noche", label: "Salir de noche" },
  { value: "fin_de_semana", label: "Fin de semana" },
  { value: "viaje", label: "Viaje" },
  { value: "casual", label: "Casual" },
];

export function SneakerPicker({ sneakers }: { sneakers: Sneaker[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // URL preset only takes effect on initial mount (good enough for deep links
  // from rotation page, since each navigation re-mounts the page).
  const initialPreset = searchParams.get("sneaker");
  const [selected, setSelected] = useState<string | null>(initialPreset);
  const [occasion, setOccasion] = useState<string>("fin_de_semana");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sneakers.length === 0) {
    return (
      <div className="flex-1 px-6 pb-6">
        <div className="border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">No tenés sneakers registradas</p>
          <p className="text-xs text-muted mt-1 mb-4">
            Agregá al menos un par para usar esta función.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/add")}
          >
            Agregar sneaker
          </Button>
        </div>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: OCCASIONS.find((o) => o.value === occasion)?.label,
          sneakerId: selected,
          outfitCount: 3,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? body.message ?? "Error");
      }
      const data = await res.json();
      sessionStorage.setItem("strike:outfits", JSON.stringify(data));
      router.push("/outfits/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 px-6 pb-6 flex flex-col">
      <div className="grid grid-cols-2 gap-3 mb-6">
        {sneakers.map((s) => {
          const isSelected = selected === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              className={cn(
                "border bg-surface text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isSelected
                  ? "border-foreground ring-1 ring-foreground"
                  : "border-border hover:border-foreground",
              )}
            >
              <div className="aspect-square bg-surface-muted flex items-center justify-center text-xs text-muted overflow-hidden">
                {s.cleaned_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.cleaned_image_url}
                    alt={s.sneaker_model ?? "Sneaker"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>Sin imagen</span>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium truncate">
                  {s.sneaker_model ?? s.subcategory ?? "Sneaker"}
                </p>
                <p className="text-[10px] text-muted uppercase tracking-wider">
                  {s.sneaker_colorway ?? s.primary_color ?? "—"}
                </p>
                {s.sneaker_prominence && (
                  <span
                    className={cn(
                      "inline-block mt-1 text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5",
                      s.sneaker_prominence === "statement" &&
                        "bg-foreground text-background",
                      s.sneaker_prominence === "icon" &&
                        "border border-foreground",
                      s.sneaker_prominence === "neutral" &&
                        "border border-border text-muted",
                    )}
                  >
                    {s.sneaker_prominence}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
          Ocasión
        </p>
        <ChipGroup
          options={OCCASIONS}
          value={occasion}
          onChange={(v) => setOccasion(v as string)}
        />
      </div>

      {error && (
        <p className="text-sm text-danger mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto">
        <Button
          size="xl"
          fullWidth
          disabled={!selected}
          loading={loading}
          onClick={handleGenerate}
        >
          Construir outfit
        </Button>
      </div>
    </div>
  );
}
