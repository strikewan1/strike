import { getSupabaseOrNull } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StyleDnaForm } from "@/components/onboarding/style-dna-form";

export const dynamic = "force-dynamic";

export default async function StyleDnaPage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("style_dna")
    .eq("id", user.id)
    .single();

  const initialDna =
    (profile?.style_dna as { preset?: string } | null)?.preset ??
    "creative_amekaji_executive";

  return (
    <div className="flex-1 flex flex-col px-6 py-10 max-w-md w-full mx-auto">
      <div className="mb-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Paso 2 de 2
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-3">
          Tu Style DNA
        </h1>
        <p className="text-sm text-muted mt-2">
          Esto guía todas las recomendaciones que te hagamos.
        </p>
      </div>

      <StyleDnaForm initial={initialDna} />

      <p className="text-xs text-muted text-center mt-8">
        Podés cambiar tu Style DNA más adelante desde tu perfil.
      </p>
    </div>
  );
}
