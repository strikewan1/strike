import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function SignupPage() {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) redirect("/");
    } catch {
      // Fall through
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="mb-10">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Strike
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-3">Crear cuenta</h1>
        <p className="text-sm text-muted mt-2">
          Empezá a construir tu guardarropa inteligente.
        </p>
      </div>

      {!isSupabaseConfigured() && (
        <div className="border border-warning/30 bg-warning/5 p-4 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-warning mb-1">
            Modo preview
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Configurá Supabase para habilitar el signup.
          </p>
        </div>
      )}

      <SignupForm disabled={!isSupabaseConfigured()} />

      <p className="text-sm text-muted text-center mt-8">
        ¿Ya tenés cuenta?{" "}
        <Link
          href="/login"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </div>
  );
}
