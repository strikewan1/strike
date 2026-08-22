import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const params = await searchParams;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) redirect("/");
    } catch {
      // Fall through to form
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center">
      <div className="mb-10">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Strike
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-3">Bienvenido</h1>
        <p className="text-sm text-muted mt-2">
          Tu director de estilo personal.
        </p>
      </div>

      {!isSupabaseConfigured() && (
        <div className="border border-warning/30 bg-warning/5 p-4 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-warning mb-1">
            Modo preview
          </p>
          <p className="text-xs text-muted leading-relaxed">
            Supabase no está configurado todavía. Configurá{" "}
            <code className="text-foreground">.env.local</code> con tus claves
            de Supabase para habilitar el login.
          </p>
        </div>
      )}

      <LoginForm redirectTo={params.redirectTo} disabled={!isSupabaseConfigured()} />

      <p className="text-sm text-muted text-center mt-8">
        ¿No tenés cuenta?{" "}
        <Link
          href="/signup"
          className="text-foreground underline-offset-4 hover:underline"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
