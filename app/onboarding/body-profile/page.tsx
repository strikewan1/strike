import { getSupabaseOrNull } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BodyProfileForm } from "@/components/onboarding/body-profile-form";

export const dynamic = "force-dynamic";

export default async function BodyProfilePage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) redirect("/login");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: body } = await supabase
    .from("body_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="flex-1 flex flex-col px-6 py-10 max-w-md w-full mx-auto">
      <div className="mb-8">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Paso 1 de 2
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-3">
          Tu cuerpo
        </h1>
        <p className="text-sm text-muted mt-2">
          Esto nos ayuda a recomendarte siluetas y proporciones correctas.
          Podés actualizarlo después.
        </p>
      </div>

      <BodyProfileForm initial={body ?? null} />

      <p className="text-xs text-muted text-center mt-8">
        Todos los datos son privados y solo se usan para personalizar tus
        recomendaciones.
      </p>
    </div>
  );
}
