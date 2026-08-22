"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BodyProfile } from "@/lib/supabase/types";

export function BodyProfileForm({ initial }: { initial: BodyProfile | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [height, setHeight] = useState(initial?.height_cm?.toString() ?? "");
  const [weight, setWeight] = useState(initial?.weight_kg?.toString() ?? "");
  const [topSize, setTopSize] = useState(initial?.top_size ?? "");
  const [bottomSize, setBottomSize] = useState(initial?.bottom_size ?? "");
  const [shoeSize, setShoeSize] = useState(
    initial?.shoe_size?.toString() ?? "",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const payload = {
        user_id: user.id,
        height_cm: height ? parseFloat(height) : null,
        weight_kg: weight ? parseFloat(weight) : null,
        top_size: topSize || null,
        bottom_size: bottomSize || null,
        shoe_size: shoeSize ? parseFloat(shoeSize) : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("body_profiles")
        .upsert(payload, { onConflict: "user_id" });

      if (error) throw error;

      router.push("/onboarding/style-dna");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el perfil",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Altura (cm)"
          type="number"
          inputMode="decimal"
          step="0.5"
          placeholder="178"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
        <Input
          label="Peso (kg)"
          type="number"
          inputMode="decimal"
          step="0.5"
          placeholder="74"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>
      <Input
        label="Talla superior (S/M/L o número)"
        placeholder="M"
        value={topSize}
        onChange={(e) => setTopSize(e.target.value)}
      />
      <Input
        label="Talla inferior (pulgadas o EU)"
        placeholder="30"
        value={bottomSize}
        onChange={(e) => setBottomSize(e.target.value)}
      />
      <Input
        label="Calzado (US)"
        type="number"
        inputMode="decimal"
        step="0.5"
        placeholder="10"
        value={shoeSize}
        onChange={(e) => setShoeSize(e.target.value)}
      />

      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4">
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Continuar
        </Button>
      </div>
    </form>
  );
}
