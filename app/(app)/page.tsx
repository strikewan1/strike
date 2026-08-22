import Link from "next/link";
import { getSupabaseOrNull } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await getSupabaseOrNull();

  let displayName: string | null = null;
  let recentLooks: Array<{
    id: string;
    occasion: string | null;
    worn_on: string;
    outfit_id: string | null;
    outfits: unknown;
  }> = [];

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      displayName = profile?.display_name ?? null;

      const { data: looks } = await supabase
        .from("wear_history")
        .select(
          `id, occasion, worn_on, outfit_id, outfits(title)`,
        )
        .eq("user_id", user.id)
        .order("worn_on", { ascending: false })
        .limit(3);
      recentLooks = looks ?? [];
    }
  }

  const greetingName = displayName ?? "Strike";

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-6 safe-top">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Strike
          </span>
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            {new Date().toLocaleDateString("es", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <h1 className="text-3xl font-medium tracking-tight mt-3">
          {greetingName},
          <br />
          <span className="text-muted">¿qué te pones?</span>
        </h1>
      </header>

      <section className="px-6 mb-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-4">
          ¿Qué quieres hacer?
        </p>
        <div className="flex flex-col gap-2">
          <Link href="/outfits/new" className="block">
            <Button fullWidth size="xl" variant="primary" className="justify-between">
              <span>¿Qué me pongo?</span>
              <span aria-hidden>→</span>
            </Button>
          </Link>
          <Link href="/add" className="block">
            <Button fullWidth size="xl" variant="outline" className="justify-between">
              <span>Agregar prenda</span>
              <span aria-hidden>+</span>
            </Button>
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link href="/outfits/build">
              <Button fullWidth size="lg" variant="outline">
                Elegir sneaker
              </Button>
            </Link>
            <Link href="/closet">
              <Button fullWidth size="lg" variant="outline">
                Ver closet
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 mb-8">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Hoy podrías usar
          </p>
          <Link
            href="/outfits/new"
            className="text-xs font-medium text-muted hover:text-foreground transition-colors"
          >
            Ver más →
          </Link>
        </div>
        <EmptyState
          title="Aún no hay sugerencias"
          description="Agregá al menos 5 prendas para que podamos armar outfits."
          actionHref="/add"
          actionLabel="Agregar primera prenda"
        />
      </section>

      <section className="px-6 mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Últimos looks
          </p>
        </div>
        {recentLooks.length > 0 ? (
          <ul className="divide-y divide-border border-y border-border">
            {recentLooks.map((look) => {
              const outfitTitle = (
                look.outfits as unknown as { title?: string } | null
              )?.title;
              return (
                <li
                  key={look.id}
                  className="py-3 flex items-center justify-between text-sm"
                >
                  <span>{outfitTitle ?? look.occasion ?? "Sin título"}</span>
                  <span className="text-xs text-muted">
                    {new Date(look.worn_on).toLocaleDateString("es", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Cuando uses un look, lo vas a ver acá.
          </p>
        )}
      </section>
    </div>
  );
}

function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
}) {
  return (
    <div className="border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted mt-1 mb-4">{description}</p>
      <Link href={actionHref}>
        <Button variant="outline" size="sm">
          {actionLabel}
        </Button>
      </Link>
    </div>
  );
}
