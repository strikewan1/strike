import { getSupabaseOrNull } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MannequinView, type MannequinOutfit } from "@/components/mannequin/mannequin-view";
import type { LayerRole } from "@/lib/body/coordinates";

export const dynamic = "force-dynamic";

export default async function MannequinPage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) return <PreviewScreen />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <PreviewScreen />;

  const [{ data: body }, { data: garments }, { data: recentOutfit }] =
    await Promise.all([
      supabase
        .from("body_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("garments")
        .select("id, kind, category, cleaned_image_url, subcategory")
        .eq("user_id", user.id)
        .eq("archived", false),
      supabase
        .from("outfits")
        .select(
          `id, title, outfit_items(garment_id, layer_role, slot_order, garments(id, cleaned_image_url, subcategory, category))`,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (!body?.height_cm) {
    return (
      <NoBodyProfileScreen
        hasAnyGarments={(garments?.length ?? 0) > 0}
      />
    );
  }

  // Build outfit from most recent saved outfit, or empty
  const outfit: MannequinOutfit | null = recentOutfit
    ? buildOutfit(recentOutfit)
    : null;

  // Body measurements
  const measurements = {
    height_cm: body.height_cm,
    weight_kg: body.weight_kg,
    shoulders_cm: body.shoulders_cm,
    chest_cm: body.chest_cm,
    waist_cm: body.waist_cm,
    inseam_cm: body.inseam_cm,
  };

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu silueta
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Body Mannequin
        </h1>
        <p className="text-sm text-muted mt-1">
          Cómo caen las prendas sobre alguien con tus proporciones.
        </p>
      </header>

      <div className="px-6 pb-6 space-y-6">
        <section className="flex justify-center bg-surface-muted border border-border py-6">
          <MannequinView
            measurements={measurements}
            outfit={outfit}
            size={220}
          />
        </section>

        {/* Stats */}
        <section>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
            Medidas
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Altura" value={body.height_cm ? `${body.height_cm} cm` : "—"} />
            <Stat label="Peso" value={body.weight_kg ? `${body.weight_kg} kg` : "—"} />
            <Stat label="Hombros" value={body.shoulders_cm ? `${body.shoulders_cm} cm` : "—"} />
            <Stat label="Cintura" value={body.waist_cm ? `${body.waist_cm} cm` : "—"} />
            <Stat label="Pecho" value={body.chest_cm ? `${body.chest_cm} cm` : "—"} />
            <Stat label="Pierna" value={body.inseam_cm ? `${body.inseam_cm} cm` : "—"} />
          </div>
        </section>

        {/* Outfit info */}
        {outfit ? (
          <section>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
              Outfit actual
            </p>
            <div className="border border-border bg-surface p-3">
              <p className="text-sm font-medium">{outfit.title}</p>
              <p className="text-xs text-muted mt-1">
                {outfit.garments.length} prendas
              </p>
              <Link href={`/outfits/${outfit.id}`}>
                <Button variant="outline" size="sm" className="mt-3 w-full">
                  Ver detalle
                </Button>
              </Link>
            </div>
          </section>
        ) : (
          <section className="border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium">Sin outfit cargado</p>
            <p className="text-xs text-muted mt-1 mb-4">
              Generá un outfit y lo vas a ver sobre tu silueta.
            </p>
            <Link href="/outfits/new">
              <Button variant="outline" size="sm">
                Generar outfit
              </Button>
            </Link>
          </section>
        )}

        <section>
          <Link href="/onboarding/body-profile">
            <Button variant="ghost" fullWidth>
              Actualizar medidas
            </Button>
          </Link>
        </section>
      </div>
    </div>
  );
}

function buildOutfit(raw: unknown): MannequinOutfit {
  const r = raw as {
    id: string;
    title: string | null;
    outfit_items: Array<{
      garment_id: string;
      layer_role: LayerRole;
      garments: {
        id: string;
        cleaned_image_url: string | null;
        subcategory: string | null;
        category: string;
      } | null;
    }> | null;
  };

  const items = (r.outfit_items ?? []) as Array<{
    garment_id: string;
    layer_role: LayerRole;
    garments: {
      id: string;
      cleaned_image_url: string | null;
      subcategory: string | null;
      category: string;
    } | null;
  }>;

  return {
    id: r.id,
    title: r.title ?? "Outfit",
    garments: items
      .map((item) => {
        const g = item.garments;
        if (!g) return null;
        return {
          role: item.layer_role,
          garment_id: g.id,
          image_url: g.cleaned_image_url,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null),
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-surface p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="text-base font-medium tabular-nums mt-1">{value}</p>
    </div>
  );
}

function NoBodyProfileScreen({ hasAnyGarments }: { hasAnyGarments: boolean }) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu silueta
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Body Mannequin
        </h1>
      </header>
      <div className="flex-1 px-6 pb-6">
        <div className="border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">Necesitamos tus medidas</p>
          <p className="text-xs text-muted mt-1 mb-4">
            El maniquí usa tu altura, peso y proporciones para mostrarte cómo
            caen las prendas sobre vos.
          </p>
          <Link href="/onboarding/body-profile">
            <Button variant="primary" size="sm">
              Configurar mi cuerpo
            </Button>
          </Link>
        </div>
        {!hasAnyGarments && (
          <p className="text-xs text-muted text-center mt-6">
            Después de configurar, agregá al menos 5 prendas para probar.
          </p>
        )}
      </div>
    </div>
  );
}

function PreviewScreen() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu silueta
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Body Mannequin
        </h1>
      </header>
      <div className="px-6 pb-6">
        <div className="border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-warning mb-1">
            Modo preview
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Configurá Supabase para usar el maniquí.
          </p>
        </div>
      </div>
    </div>
  );
}
