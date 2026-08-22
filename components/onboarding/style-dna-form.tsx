"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DnaPreset {
  id: string;
  name: string;
  description: string;
}

const PRESETS: DnaPreset[] = [
  {
    id: "creative_amekaji_executive",
    name: "Creative Amekaji Executive",
    description:
      "Mezcla de Japanese Americana, City Boy, workwear reinterpretado e Ivy. Sneakerhead. Parece director creativo hasta que habla de negocio.",
  },
  {
    id: "minimal_tech",
    name: "Minimal Tech",
    description:
      "Neutros, técnicos, silenciosos. Siluetas limpias,Accessorizing mínimo. Para el creativo de la fintech.",
  },
  {
    id: "streetwear_focused",
    name: "Streetwear Focused",
    description:
      "Hype, drops, collabs. La pieza más llamativa es el outfit. Sneakers y graphics lideran.",
  },
];

export function StyleDnaForm({ initial }: { initial: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { error: dnaError } = await supabase
        .from("profiles")
        .update({
          style_dna: { preset: selected },
        })
        .eq("id", user.id);

      if (dnaError) throw dnaError;

      const { error: onboardingError } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("id", user.id);

      if (onboardingError) throw onboardingError;

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el Style DNA",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {PRESETS.map((preset) => {
        const isSelected = selected === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => setSelected(preset.id)}
            className={cn(
              "border bg-surface p-4 text-left transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isSelected ? "border-foreground" : "border-border hover:border-foreground",
            )}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-sm font-medium tracking-tight">
                {preset.name}
              </h3>
              <span
                className={cn(
                  "h-3 w-3 shrink-0 border",
                  isSelected
                    ? "bg-foreground border-foreground"
                    : "border-border-strong",
                )}
                aria-hidden
              />
            </div>
            <p className="text-xs text-muted leading-relaxed">
              {preset.description}
            </p>
          </button>
        );
      })}

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4">
        <Button onClick={handleSubmit} size="lg" fullWidth loading={loading}>
          Empezar
        </Button>
      </div>
    </div>
  );
}
