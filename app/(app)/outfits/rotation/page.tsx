import { getSupabaseOrNull } from "@/lib/supabase/server";
import { SneakerRotationView } from "@/components/outfits/sneaker-rotation-view";

export const dynamic = "force-dynamic";

export default async function SneakerRotationPage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) {
    return <PreviewScreen />;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <PreviewScreen />;

  const { data: sneakers } = await supabase
    .from("garments")
    .select(
      "id, subcategory, primary_color, secondary_colors, cleaned_image_url, brand, sneaker_model, sneaker_colorway, sneaker_silhouette, sneaker_prominence, wear_count, last_worn, created_at",
    )
    .eq("user_id", user.id)
    .eq("kind", "sneaker")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu colección
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Sneaker Rotation
        </h1>
        <p className="text-sm text-muted mt-1">
          Aprovechá todos tus pares. Evitá que alguno quede en el olvido.
        </p>
      </header>

      <SneakerRotationView sneakers={sneakers ?? []} />
    </div>
  );
}

function PreviewScreen() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu colección
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Sneaker Rotation
        </h1>
      </header>
      <div className="px-6 pb-6">
        <div className="border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-warning mb-1">
            Modo preview
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Configurá Supabase para ver tu rotación.
          </p>
        </div>
      </div>
    </div>
  );
}
