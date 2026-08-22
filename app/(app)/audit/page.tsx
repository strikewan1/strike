import { getSupabaseOrNull } from "@/lib/supabase/server";
import { AuditView } from "@/components/audit/audit-view";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const supabase = await getSupabaseOrNull();
  if (!supabase) {
    return <PreviewScreen title="Wardrobe Audit" />;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <PreviewScreen title="Wardrobe Audit" />;

  const { data: garments } = await supabase
    .from("garments")
    .select(
      "id, kind, category, subcategory, primary_color, fit, cleaned_image_url, wear_count, last_worn, style_tags, wardrobe_status, brand",
    )
    .eq("user_id", user.id)
    .eq("archived", false);

  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Diagnóstico
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Wardrobe Audit
        </h1>
        <p className="text-sm text-muted mt-1">
          Qué funciona, qué no, qué sobra.
        </p>
      </header>

      <AuditView garments={garments ?? []} />
    </div>
  );
}

function PreviewScreen({ title }: { title: string }) {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Diagnóstico
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">{title}</h1>
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
