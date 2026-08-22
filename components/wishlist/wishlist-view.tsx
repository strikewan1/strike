"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChipGroup } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import type { WishlistItem, WishlistStatus } from "@/lib/supabase/types";

interface ClosetItem {
  id: string;
  category: string;
  subcategory: string | null;
  primary_color: string | null;
  fit: string | null;
}

const STATUS_OPTIONS: Array<{ value: WishlistStatus; label: string }> = [
  { value: "inspiration", label: "Inspiración" },
  { value: "maybe", label: "Quizás" },
  { value: "priority", label: "Prioridad" },
  { value: "dismissed", label: "Descartado" },
  { value: "bought", label: "Comprado" },
];

export function WishlistView({
  items,
  closet,
}: {
  items: WishlistItem[];
  closet: ClosetItem[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<WishlistStatus | "all">("all");

  const filtered =
    filter === "all" ? items : items.filter((i) => i.status === filter);

  // Counts by status
  const counts: Record<WishlistStatus, number> = {
    inspiration: 0,
    maybe: 0,
    priority: 0,
    dismissed: 0,
    bought: 0,
  };
  for (const i of items) counts[i.status]++;

  // Detect duplicates in closet by signature
  function findDuplicates(item: WishlistItem): ClosetItem[] {
    if (!item.description && !item.image_url) return [];
    // Use description as a hint; match by signature on closet items
    const desc = (item.description ?? "").toLowerCase();
    return closet.filter((g) => {
      const sig = `${g.subcategory} ${g.primary_color}`;
      return desc.includes(sig.toLowerCase());
    });
  }

  const handleStatusChange = async (id: string, status: WishlistStatus) => {
    const supabase = createClient();
    await supabase.from("wishlist_items").update({ status }).eq("id", id);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este item?")) return;
    const supabase = createClient();
    await supabase.from("wishlist_items").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div className="flex-1 px-6 pb-6 space-y-4">
      {/* Status filter */}
      <ChipGroup
        options={[
          { value: "all", label: `Todas (${items.length})` },
          ...STATUS_OPTIONS.map((s) => ({
            value: s.value,
            label: `${s.label} (${counts[s.value]})`,
          })),
        ]}
        value={filter}
        onChange={(v) => setFilter(v as WishlistStatus | "all")}
      />

      {filtered.length === 0 ? (
        <div className="border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">
            {items.length === 0
              ? "Tu wishlist está vacía"
              : "No hay items en esta categoría"}
          </p>
          <p className="text-xs text-muted mt-1">
            Agregá referencias desde la sección Inspire con el botón
            &ldquo;Quiero algo así&rdquo;.
          </p>
        </div>
      ) : (
        <ul className="border border-border bg-surface divide-y divide-border">
          {filtered.map((item) => {
            const dups = findDuplicates(item);
            return (
              <li key={item.id} className="p-3 flex gap-3">
                <div className="h-16 w-16 bg-surface-muted shrink-0 overflow-hidden">
                  {item.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {item.description ?? "Sin descripción"}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wider">
                    Agregado{" "}
                    {new Date(item.created_at).toLocaleDateString("es", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  {dups.length > 0 && (
                    <p
                      className={cn(
                        "text-xs mt-1 px-2 py-1 border border-warning text-warning",
                      )}
                    >
                      ⚠ Ya tenés {dups.length}{" "}
                      {dups.length === 1 ? "pieza similar" : "piezas similares"}{" "}
                      en tu closet.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => handleStatusChange(item.id, s.value)}
                        className={cn(
                          "text-[10px] font-medium uppercase tracking-wider px-2 py-1 border transition-colors",
                          item.status === s.value
                            ? "bg-foreground text-background border-foreground"
                            : "bg-transparent border-border text-muted hover:border-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="text-muted hover:text-danger text-xs self-start"
                  aria-label="Eliminar"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
