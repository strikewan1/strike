import { getSupabaseOrNull } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ReferenceDetailView } from "@/components/inspire/reference-detail-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function ReferenceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await getSupabaseOrNull();
  if (!supabase) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: reference } = await supabase
    .from("outfit_references")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!reference) notFound();

  return <ReferenceDetailView reference={reference} />;
}
