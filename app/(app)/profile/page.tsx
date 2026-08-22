import { getSupabaseOrNull } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) return <PreviewProfile />;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <PreviewProfile />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, style_dna, onboarding_completed")
    .eq("id", user!.id)
    .single();

  const { data: body } = await supabase
    .from("body_profiles")
    .select("*")
    .eq("user_id", user!.id)
    .single();

  return (
    <div className="flex flex-col">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Acerca de vos
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">Profile</h1>
      </header>

      <div className="px-6 pb-6 space-y-6">
        {/* Identity */}
        <section>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
            Identidad
          </p>
          <div className="border border-border bg-surface divide-y divide-border">
            <Row label="Nombre" value={profile?.display_name ?? "—"} />
            <Row label="Email" value={user?.email ?? "—"} />
            <Row
              label="Style DNA"
              value={
                (profile?.style_dna as { preset?: string } | null)?.preset ??
                "creative_amekaji_executive"
              }
            />
          </div>
        </section>

        {/* Body */}
        <section>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
              Cuerpo
            </p>
            <Link
              href="/onboarding/body-profile"
              className="text-xs text-muted hover:text-foreground underline-offset-4 hover:underline"
            >
              Editar
            </Link>
          </div>
          <div className="border border-border bg-surface divide-y divide-border">
            <Row
              label="Altura"
              value={body?.height_cm ? `${body.height_cm} cm` : "—"}
            />
            <Row
              label="Peso"
              value={body?.weight_kg ? `${body.weight_kg} kg` : "—"}
            />
            <Row label="Talla superior" value={body?.top_size ?? "—"} />
            <Row label="Talla inferior" value={body?.bottom_size ?? "—"} />
            <Row
              label="Calzado"
              value={body?.shoe_size ? `US ${body.shoe_size}` : "—"}
            />
          </div>
        </section>

        {/* Sections placeholder */}
        <section>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
            Tu silueta
          </p>
          <Link href="/mannequin" className="block">
            <Button fullWidth variant="outline" className="justify-between">
              <span>Ver body mannequin</span>
              <span aria-hidden>→</span>
            </Button>
          </Link>
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
            Memoria de estilo
          </p>
          <div className="border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted">
              La memoria se construye con tu uso y feedback.
            </p>
          </div>
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
            Auditoría
          </p>
          <Link href="/audit" className="block">
            <Button fullWidth variant="outline" className="justify-between">
              <span>Ver auditoría del closet</span>
              <span aria-hidden>→</span>
            </Button>
          </Link>
        </section>

        <section>
          <LogoutButton />
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PreviewProfile() {
  return (
    <div className="flex flex-col">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Acerca de vos
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">Profile</h1>
      </header>

      <div className="px-6 pb-6">
        <div className="border border-warning/30 bg-warning/5 p-4 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-warning mb-1">
            Modo preview
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Configurá Supabase para ver tu perfil real.
          </p>
        </div>
      </div>
    </div>
  );
}
