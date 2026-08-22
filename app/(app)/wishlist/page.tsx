import { getSupabaseOrNull } from "@/lib/supabase/server";
import { WishlistView } from "@/components/wishlist/wishlist-view";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) {
    return <PreviewScreen />;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <PreviewScreen />;

  const { data: items } = await supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Get closet counts by category to flag duplicates
  const { data: garments } = await supabase
    .from("garments")
    .select("id, category, subcategory, primary_color, fit")
    .eq("user_id", user.id)
    .eq("archived", false);

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu lista
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">Wishlist</h1>
        <p className="text-sm text-muted mt-1">
          Cosas que querés. Antes de comprar, revisá si ya las tenés.
        </p>
      </header>

      <WishlistView
        items={items ?? []}
        closet={garments ?? []}
      />
    </div>
  );
}

function PreviewScreen() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu lista
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">Wishlist</h1>
      </header>
      <div className="px-6 pb-6">
        <div className="border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-warning mb-1">
            Modo preview
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Configurá Supabase para usar la wishlist.
          </p>
        </div>
      </div>
    </div>
  );
}
