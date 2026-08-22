import { getSupabaseOrNull } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InspireListPage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) return <PreviewInspire />;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <PreviewInspire />;

  const { data: references } = await supabase
    .from("outfit_references")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu biblioteca
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          References
        </h1>
        <p className="text-sm text-muted mt-1">
          Looks que te inspiran. No se mezclan con tu closet.
        </p>
      </header>

      <div className="px-6 pb-6">
        <Link href="/inspire/new" className="block mb-6">
          <Button fullWidth size="lg" variant="primary" className="justify-between">
            <span>+ Agregar referencia</span>
            <span aria-hidden>+</span>
          </Button>
        </Link>

        {references && references.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {references.map((r) => (
              <Link
                key={r.id}
                href={`/inspire/${r.id}`}
                className="border border-border bg-surface block hover:border-foreground transition-colors"
              >
                <div className="aspect-square bg-surface-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url}
                    alt={r.title ?? "Referencia"}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">
                    {r.title ?? "Referencia"}
                  </p>
                  {r.style_tags && r.style_tags.length > 0 && (
                    <p className="text-[10px] text-muted uppercase tracking-wider truncate">
                      {r.style_tags.slice(0, 3).join(" · ")}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium">Tu biblioteca está vacía</p>
            <p className="text-xs text-muted mt-1">
              Subí un screenshot o foto de un look que te guste.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewInspire() {
  return (
    <div className="flex flex-col">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu biblioteca
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">References</h1>
      </header>
      <div className="px-6 pb-6">
        <div className="border border-warning/30 bg-warning/5 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-warning">
            Modo preview
          </p>
        </div>
      </div>
    </div>
  );
}
