import { getSupabaseOrNull } from "@/lib/supabase/server";
import { SneakerPicker } from "@/components/outfits/sneaker-picker";

export const dynamic = "force-dynamic";

export default async function BuildAroundSneakersPage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) return <PreviewSneakers sneakers={[]} />;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <PreviewSneakers sneakers={[]} />;

  const { data: sneakers } = await supabase
    .from("garments")
    .select(
      "id, subcategory, primary_color, cleaned_image_url, brand, sneaker_model, sneaker_colorway, sneaker_silhouette, sneaker_prominence",
    )
    .eq("user_id", user!.id)
    .eq("kind", "sneaker")
    .eq("archived", false)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Empezamos por las zapatillas
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Build around my sneakers
        </h1>
        <p className="text-sm text-muted mt-1">
          Elegí el par y armamos el outfit alrededor.
        </p>
      </header>

      <SneakerPicker
        sneakers={sneakers ?? []}
      />
    </div>
  );
}

function PreviewSneakers({ sneakers }: { sneakers: never[] }) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Empezamos por las zapatillas
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Build around my sneakers
        </h1>
      </header>
      <div className="px-6 pb-6">
        <div className="border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-warning">
            Modo preview
          </p>
        </div>
        <SneakerPicker sneakers={sneakers} />
      </div>
    </div>
  );
}
