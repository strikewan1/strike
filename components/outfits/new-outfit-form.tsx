"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

// Default cooldown when the AI responds with a rate-limit error but
// doesn't tell us how long to wait. Per-minute limits reset at the
// top of each minute, so 60s is a safe upper bound.
const DEFAULT_COOLDOWN_SECONDS = 60;

/**
 * Pull the wait time out of an error message like "Please retry in
 * 30.5s." or "retry in 9s." Returns null if not parseable.
 */
function parseRetryAfter(message: string | undefined): number | null {
  if (!message) return null;
  const m = message.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? Math.max(1, Math.ceil(n)) : null;
}

export function NewOutfitForm() {
  const router = useRouter();
  const [occasion, setOccasion] = useState<string>("trabajo");
  const [contextText, setContextText] = useState("");
  const [temp, setTemp] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cooldown timestamp (epoch ms) when to allow the next request.
  // Displayed as a countdown on the submit button.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Tick down once per second while cooling down.
  useEffect(() => {
    if (cooldownUntil === null) return;
    const tick = () => {
      const ms = cooldownUntil - Date.now();
      if (ms <= 0) {
        setCooldownUntil(null);
        setSecondsLeft(0);
      } else {
        setSecondsLeft(Math.ceil(ms / 1000));
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const handleSubmit = async () => {
    if (cooldownUntil && cooldownUntil > Date.now()) {
      // Blocked by cooldown — UI should prevent this anyway.
      return;
    }
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
        const message =
          (body as { error?: string; message?: string }).error ??
          (body as { message?: string }).message ??
          "Error al generar";

        // Cooldown on rate limit / quota errors. Use the retry hint from
        // the server if present, otherwise default to 60s.
        if (
          message.toLowerCase().includes("rate limit") ||
          message.toLowerCase().includes("quota") ||
          message.toLowerCase().includes("esperá")
        ) {
          const hint = parseRetryAfter(
            (body as { raw?: string }).raw ?? message,
          );
          const wait = hint ?? DEFAULT_COOLDOWN_SECONDS;
          setCooldownUntil(Date.now() + wait * 1000);
          toast.error(message, { duration: 6000 });
        }

        throw new Error(message);
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

  const onCooldown = cooldownUntil !== null && secondsLeft > 0;
  const buttonLabel = loading
    ? "Construyendo outfits…"
    : onCooldown
      ? `Esperá ${secondsLeft}s`
      : "Generar outfits";

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
          disabled={onCooldown}
          aria-busy={loading || onCooldown}
        >
          {buttonLabel}
        </Button>
        {onCooldown && (
          <p className="text-xs text-muted text-center mt-2">
            Cooldown de Gemini · el botón se habilita automáticamente
          </p>
        )}
      </div>
    </div>
  );
}
