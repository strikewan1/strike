"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Garment } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

interface OutfitSuggestion {
  title: string;
  garments: Array<{ garment_id: string; layer_role: string }>;
  explanation: string;
  formality: number;
}

interface OutfitData {
  outfits: OutfitSuggestion[];
  notes: string | null;
}

function loadOutfitsFromSession(): OutfitData | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("strike:outfits");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OutfitData;
  } catch {
    return null;
  }
}

export function OutfitResults() {
  const router = useRouter();
  const [data] = useState<OutfitData | null>(() => loadOutfitsFromSession());
  const [garments, setGarments] = useState<Record<string, Garment>>({});
  const [savingOutfitId, setSavingOutfitId] = useState<string | null>(null);

  // External sync: fetch garments, redirect if no data
  useEffect(() => {
    if (!data) {
      router.replace("/outfits/new");
      return;
    }
    const ids = Array.from(
      new Set(data.outfits.flatMap((o) => o.garments.map((g) => g.garment_id))),
    );
    if (ids.length === 0) return;

    const supabase = createClient();
    let cancelled = false;
    supabase
      .from("garments")
      .select("*")
      .in("id", ids)
      .then(({ data: rows }) => {
        if (cancelled || !rows) return;
        const map: Record<string, Garment> = {};
        for (const g of rows as Garment[]) map[g.id] = g;
        setGarments(map);
      });

    return () => {
      cancelled = true;
    };
  }, [data, router]);

  if (!data) {
    return <div className="px-6 text-sm text-muted">Cargando…</div>;
  }

  const handleUseLook = async (outfit: OutfitSuggestion, idx: number) => {
    const id = `${idx}-${outfit.title}`;
    setSavingOutfitId(id);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      // Save outfit
      const { data: outfitRow, error: outfitErr } = await supabase
        .from("outfits")
        .insert({
          user_id: user.id,
          title: outfit.title,
          explanation: outfit.explanation,
          formality: outfit.formality,
          ai_generated: true,
        })
        .select()
        .single();
      if (outfitErr) throw outfitErr;

      // Save outfit_items
      const items = outfit.garments.map((g, i) => ({
        outfit_id: outfitRow.id,
        garment_id: g.garment_id,
        layer_role: g.layer_role,
        slot_order: i,
      }));
      await supabase.from("outfit_items").insert(items);

      // Save wear_history
      await supabase.from("wear_history").insert({
        user_id: user.id,
        outfit_id: outfitRow.id,
        garment_ids: outfit.garments.map((g) => g.garment_id),
      });

      // Update wear metadata on each garment
      const today = new Date().toISOString().slice(0, 10);
      for (const g of outfit.garments) {
        await supabase
          .from("garments")
          .update({ last_worn: today })
          .eq("id", g.garment_id);
      }

      sessionStorage.removeItem("strike:outfits");
      router.push(`/outfits/${outfitRow.id}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSavingOutfitId(null);
    }
  };

  return (
    <div className="flex-1 px-6 pb-6 space-y-6">
      {data.outfits.map((outfit, idx) => (
        <OutfitCard
          key={idx}
          outfit={outfit}
          garments={garments}
          onUseLook={() => handleUseLook(outfit, idx)}
          isSaving={savingOutfitId === `${idx}-${outfit.title}`}
        />
      ))}

      {data.notes && (
        <p className="text-xs text-muted italic">{data.notes}</p>
      )}

      <div className="pt-2">
        <Link href="/outfits/new">
          <Button variant="outline" fullWidth>
            Probar otra ocasión
          </Button>
        </Link>
      </div>
    </div>
  );
}

function OutfitCard({
  outfit,
  garments,
  onUseLook,
  isSaving,
}: {
  outfit: OutfitSuggestion;
  garments: Record<string, Garment>;
  onUseLook: () => void;
  isSaving: boolean;
}) {
  const byRole: Record<string, Garment[]> = {
    top: [],
    layer: [],
    bottom: [],
    footwear: [],
    accessory: [],
  };
  for (const ref of outfit.garments) {
    const g = garments[ref.garment_id];
    if (!g) continue;
    byRole[ref.layer_role]?.push(g);
  }

  return (
    <article className="border border-border bg-surface">
      <div className="p-4 border-b border-border">
        <h3 className="text-base font-medium tracking-tight">{outfit.title}</h3>
        <p className="text-[10px] text-muted uppercase tracking-wider mt-1">
          Formalidad {outfit.formality}/5
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 p-3 bg-surface-muted">
        {outfit.garments.map((ref) => {
          const g = garments[ref.garment_id];
          if (!g?.cleaned_image_url) return null;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={ref.garment_id}
              src={g.cleaned_image_url}
              alt={g.subcategory ?? g.category}
              className="aspect-square object-cover bg-surface border border-border"
            />
          );
        })}
      </div>

      <ul className="divide-y divide-border text-sm">
        {Object.entries(byRole).map(
          ([role, items]) =>
            items.length > 0 && (
              <li
                key={role}
                className="flex items-center justify-between px-4 py-2"
              >
                <span className="text-xs font-medium uppercase tracking-wider text-muted">
                  {role}
                </span>
                <span className="text-right">
                  {items
                    .map((g) => g.subcategory?.replace(/_/g, " ") ?? g.category)
                    .join(", ")}
                </span>
              </li>
            ),
        )}
      </ul>

      <div className="px-4 py-3 border-t border-border bg-surface-muted">
        <p className="text-xs font-medium uppercase tracking-wider text-muted mb-1">
          Por qué funciona
        </p>
        <p className="text-sm leading-relaxed">{outfit.explanation}</p>
      </div>

      <div className="p-4 border-t border-border">
        <Button onClick={onUseLook} loading={isSaving} fullWidth>
          Usé este look
        </Button>
      </div>
    </article>
  );
}
