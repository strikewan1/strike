"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Chip, ChipGroup } from "@/components/ui/chip";

const OCCASIONS = [
  { value: "trabajo", label: "Trabajo" },
  { value: "oficina_relajada", label: "Oficina relajada" },
  { value: "reunion", label: "Reunión" },
  { value: "presentacion", label: "Presentación" },
  { value: "cena", label: "Cena" },
  { value: "cita", label: "Cita" },
  { value: "parrilla", label: "Parrillada" },
  { value: "salir_noche", label: "Salir de noche" },
  { value: "concierto", label: "Concierto" },
  { value: "fin_de_semana", label: "Fin de semana" },
  { value: "aeropuerto", label: "Aeropuerto" },
  { value: "viaje", label: "Viaje" },
  { value: "evento", label: "Evento" },
];

export function NewOutfitForm() {
  const router = useRouter();
  const [occasion, setOccasion] = useState<string>("trabajo");
  const [contextText, setContextText] = useState("");
  const [temp, setTemp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: OCCASIONS.find((o) => o.value === occasion)?.label ?? occasion,
          contextText: contextText || undefined,
          weather: temp ? { temp: parseFloat(temp) } : undefined,
          outfitCount: 3,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? body.message ?? "Error al generar");
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

      <div className="mb-6">
        <Textarea
          label="Contexto libre (opcional)"
          value={contextText}
          onChange={(e) => setContextText(e.target.value)}
          placeholder='Ej: "Tengo una parrillada en una terraza de Lima de tarde a noche. Voy a cocinar y después conversar."'
          hint="La IA interpreta matices que los chips no cubren."
        />
      </div>

      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
          Temperatura (°C, opcional)
        </p>
        <div className="flex gap-2 flex-wrap">
          {["10", "18", "24", "30"].map((t) => (
            <Chip
              key={t}
              selected={temp === t}
              onClick={() => setTemp(temp === t ? "" : t)}
              type="button"
            >
              {t}°
            </Chip>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-danger mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto pt-6">
        <Button
          size="xl"
          fullWidth
          onClick={handleSubmit}
          loading={loading}
        >
          {loading ? "Construyendo outfits…" : "Generar outfits"}
        </Button>
      </div>
    </div>
  );
}
