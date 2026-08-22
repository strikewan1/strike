import { getSupabaseOrNull } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { FitCheckForm } from "@/components/outfits/fit-check-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function OutfitDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getSupabaseOrNull();
  if (!supabase) notFound();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: outfit } = await supabase
    .from("outfits")
    .select(
      `
      *,
      outfit_items(
        id,
        garment_id,
        layer_role,
        slot_order,
        garments(id, subcategory, primary_color, cleaned_image_url, brand)
      )
    `,
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!outfit) notFound();

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Look guardado
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          {outfit.title ?? "Outfit"}
        </h1>
      </header>

      <div className="px-6 pb-6 space-y-6">
        {/* Items */}
        <section>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
            Prendas
          </p>
          <ul className="space-y-2">
            {outfit.outfit_items
              ?.sort(
                (a: { slot_order: number }, b: { slot_order: number }) =>
                  a.slot_order - b.slot_order,
              )
              .map(
                (item: {
                  id: string;
                  layer_role: string;
                  garments: {
                    id: string;
                    subcategory: string | null;
                    primary_color: string | null;
                    cleaned_image_url: string | null;
                    brand: string | null;
                  } | null;
                }) => {
                  const g = item.garments;
                  if (!g) return null;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 border border-border bg-surface p-2"
                    >
                      <div className="h-12 w-12 bg-surface-muted shrink-0">
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
                          {g.subcategory?.replace(/_/g, " ") ?? "Prenda"}
                        </p>
                        <p className="text-xs text-muted uppercase tracking-wider">
                          {item.layer_role} · {g.primary_color ?? "—"}
                        </p>
                      </div>
                    </li>
                  );
                },
              )}
          </ul>
        </section>

        {/* Explanation */}
        {outfit.explanation && (
          <section>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
              Por qué funciona
            </p>
            <p className="text-sm leading-relaxed">{outfit.explanation}</p>
          </section>
        )}

        {/* Fit check */}
        <section className="border-t border-border pt-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
            Así quedó
          </p>
          <FitCheckForm outfitId={outfit.id} />
        </section>

        <section className="pt-2">
          <Link href="/outfits">
            <Button variant="outline" fullWidth>
              Volver a outfits
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
