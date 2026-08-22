import Link from "next/link";
import { getSupabaseOrNull } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ClosetPage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) return <EmptyCloset />;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <EmptyCloset />;

  const { data: garments } = await supabase
    .from("garments")
    .select("id, kind, category, subcategory, primary_color, fit, cleaned_image_url, favorite")
    .eq("user_id", user!.id)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu guardarropa
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">Closet</h1>
        <p className="text-sm text-muted mt-1">
          {garments?.length ?? 0} prendas registradas
        </p>
      </header>

      <div className="px-6 pb-6">
        {garments && garments.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {garments.map((g) => (
              <article
                key={g.id}
                className="border border-border bg-surface aspect-[3/4] flex flex-col"
              >
                <div className="flex-1 bg-surface-muted flex items-center justify-center text-muted text-xs">
                  {g.cleaned_image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={g.cleaned_image_url}
                      alt={g.subcategory ?? g.category}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>Sin imagen</span>
                  )}
                </div>
                <div className="p-2 border-t border-border">
                  <p className="text-xs font-medium truncate">
                    {g.subcategory ?? g.category}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-wider">
                    {g.primary_color ?? "—"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium">Tu closet está vacío</p>
            <p className="text-xs text-muted mt-1 mb-4">
              Empezá registrando tu primera prenda.
            </p>
            <Link href="/add">
              <Button variant="outline" size="sm">
                Agregar prenda
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyCloset() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu guardarropa
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">Closet</h1>
      </header>
      <div className="px-6 pb-6">
        <div className="border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-warning mb-1">
            Modo preview
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Configurá Supabase para ver tu closet.
          </p>
        </div>
      </div>
    </div>
  );
}
