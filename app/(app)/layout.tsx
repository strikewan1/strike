import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient, getUser, isSupabaseConfigured } from "@/lib/supabase/server";
import { BottomNav } from "@/components/bottom-nav";

// All routes in (app) require a session and DB access.
// Force dynamic so we never try to prerender without env vars.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // If Supabase isn't configured, render the UI in preview mode without auth gating.
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 pb-20">{children}</main>
        <BottomNav />
      </div>
    );
  }

  const user = await getUser();
  if (!user) redirect("/login");

  try {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile && !profile.onboarding_completed) {
      redirect("/onboarding/body-profile");
    }
  } catch {
    // If DB query fails, allow through (preview-ish)
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
