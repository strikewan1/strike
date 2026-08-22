"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OutfitReference } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

interface RecreationResult {
  matches: Array<{
    reference_item: { type: string; color: string; description?: string };
    matched: { id: string; category: string; subcategory: string | null; primary_color: string | null } | null;
    score: number | null;
  }>;
  coverage: number;
  suggested_outfit: {
    outfits: Array<{
      title: string;
      garments: Array<{ garment_id: string; layer_role: string }>;
      explanation: string;
      formality: number;
    }>;
    notes: string | null;
  } | null;
}

export function ReferenceDetailView({ reference }: { reference: OutfitReference }) {
  const [result, setResult] = useState<RecreationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wishlistAdded, setWishlistAdded] = useState(false);

  const handleRecreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/recreate-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceId: reference.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al recrear");
      }
      const data = (await res.json()) as RecreationResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWishlist = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { error } = await supabase.from("wishlist_items").insert({
        user_id: user.id,
        reference_id: reference.id,
        image_url: reference.image_url,
        description: reference.title,
        status: "inspiration",
        closet_duplicate_ids: [],
      });
      if (error) throw error;
      setWishlistAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  const detected = (reference.detected_items ?? []) as Array<{
    type: string;
    color: string;
    description?: string;
  }>;

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Referencia
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          {reference.title ?? "Sin título"}
        </h1>
      </header>

      <div className="px-6 pb-6 space-y-6">
        {/* Image */}
        <div className="aspect-square bg-surface-muted border border-border overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={reference.image_url}
            alt={reference.title ?? "Referencia"}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Detected items */}
        {detected.length > 0 && (
          <section>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
              Análisis
            </p>
            <ul className="border border-border bg-surface divide-y divide-border text-sm">
              {detected.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <span className="font-medium capitalize">{item.type}</span>
                  <span className="text-muted">
                    {item.color}
                    {item.description ? ` · ${item.description}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Style tags */}
        {reference.style_tags && reference.style_tags.length > 0 && (
          <section>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
              Estilo
            </p>
            <div className="flex flex-wrap gap-2">
              {reference.style_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-1 border border-border uppercase tracking-wider"
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        <section className="space-y-2">
          <Button
            fullWidth
            size="xl"
            variant="primary"
            onClick={handleRecreate}
            loading={loading}
          >
            {loading ? "Buscando equivalentes…" : "¿Puedo recrearlo?"}
          </Button>
          <Button
            fullWidth
            variant={wishlistAdded ? "secondary" : "outline"}
            onClick={handleAddToWishlist}
            disabled={wishlistAdded}
          >
            {wishlistAdded ? "✓ En wishlist" : "Quiero algo así"}
          </Button>
        </section>

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        {/* Results */}
        {result && (
          <>
            <RecreationMatches matches={result.matches} coverage={result.coverage} />
            {result.suggested_outfit && (
              <SuggestedOutfit outfit={result.suggested_outfit} />
            )}
          </>
        )}

        {/* Source URL */}
        {reference.source_url && (
          <section className="text-xs text-muted">
            <a
              href={reference.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Ver origen →
            </a>
          </section>
        )}

        <section>
          <Link href="/inspire">
            <Button variant="ghost" fullWidth>
              Volver a references
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}

function RecreationMatches({
  matches,
  coverage,
}: {
  matches: RecreationResult["matches"];
  coverage: number;
}) {
  const coverageLabel =
    coverage >= 0.8
      ? "Casi todo lo tenés"
      : coverage >= 0.5
        ? "Tenés la mitad"
        : coverage >= 0.2
          ? "Necesitás algunas piezas"
          : "Casi nada de lo que usaron";

  const coverageColor =
    coverage >= 0.8
      ? "text-success"
      : coverage >= 0.5
        ? "text-foreground"
        : coverage >= 0.2
          ? "text-warning"
          : "text-muted";

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Cobertura
        </p>
        <span
          className={cn("text-xs font-medium uppercase tracking-wider", coverageColor)}
        >
          {Math.round(coverage * 100)}% · {coverageLabel}
        </span>
      </div>
      <ul className="border border-border bg-surface divide-y divide-border text-sm">
        {matches.map((m, i) => (
          <li key={i} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <span
                className={cn(
                  "shrink-0 inline-flex items-center justify-center h-6 w-6 border text-xs font-medium",
                  m.matched
                    ? "bg-foreground text-background border-foreground"
                    : "border-border-strong text-muted",
                )}
                aria-hidden
              >
                {m.matched ? "✓" : "—"}
              </span>
              <span className="capitalize font-medium">{m.reference_item.type}</span>
              <span className="text-muted truncate">
                {m.matched
                  ? `= ${m.matched.subcategory?.replace(/_/g, " ") ?? m.matched.category} (${m.matched.primary_color ?? "—"})`
                  : `(${m.reference_item.color}) no encontrada`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SuggestedOutfit({
  outfit,
}: {
  outfit: NonNullable<RecreationResult["suggested_outfit"]>;
}) {
  return (
    <section>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
        Alternativa con tu closet
      </p>
      <div className="space-y-3">
        {outfit.outfits.map((o, i) => (
          <article key={i} className="border border-border bg-surface">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-medium tracking-tight">{o.title}</h3>
            </div>
            <div className="px-4 py-3 bg-surface-muted">
              <p className="text-xs font-medium uppercase tracking-wider text-muted mb-1">
                Por qué funciona
              </p>
              <p className="text-sm leading-relaxed">{o.explanation}</p>
            </div>
          </article>
        ))}
        {outfit.notes && (
          <p className="text-xs text-muted italic">{outfit.notes}</p>
        )}
      </div>
    </section>
  );
}
