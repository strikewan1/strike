import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/server";

// Cache for 1 minute — health checks shouldn't hit DB on every call
export const revalidate = 60;
export const dynamic = "force-dynamic";

interface HealthCheck {
  name: string;
  status: "ok" | "warn" | "fail" | "skip";
  message?: string;
  latency_ms?: number;
}

const APP_VERSION = "0.1.0";
const START_TIME = Date.now();

export async function GET() {
  const checks: HealthCheck[] = [];
  const startedAt = Date.now();

  // 1. Env vars configured?
  checks.push({
    name: "supabase_configured",
    status: isSupabaseConfigured() ? "ok" : "warn",
    message: isSupabaseConfigured()
      ? "Supabase env vars present"
      : "Supabase not configured (preview mode)",
  });

  checks.push({
    name: "google_ai_configured",
    status: process.env.GOOGLE_AI_API_KEY ? "ok" : "warn",
    message: process.env.GOOGLE_AI_API_KEY
      ? "Google AI API key present"
      : "Google AI not configured (mocks will be returned)",
  });

  checks.push({
    name: "sentry_configured",
    status: process.env.SENTRY_DSN ? "ok" : "skip",
    message: process.env.SENTRY_DSN ? "Sentry enabled" : "Sentry not configured",
  });

  // 2. Database reachability (only if Supabase is configured)
  if (isSupabaseConfigured()) {
    const dbStart = Date.now();
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      // Cheap query: just check auth schema
      const { error } = await supabase
        .from("profiles")
        .select("count", { count: "exact", head: true });
      checks.push({
        name: "database_reachable",
        status: error ? "fail" : "ok",
        message: error?.message ?? "Connected",
        latency_ms: Date.now() - dbStart,
      });
    } catch (err) {
      checks.push({
        name: "database_reachable",
        status: "fail",
        message: err instanceof Error ? err.message : "Unknown error",
        latency_ms: Date.now() - dbStart,
      });
    }
  } else {
    checks.push({
      name: "database_reachable",
      status: "skip",
      message: "Skipped (Supabase not configured)",
    });
  }

  // 3. Aggregate
  const overall: "ok" | "degraded" | "down" = checks.some((c) => c.status === "fail")
    ? "down"
    : checks.some((c) => c.status === "warn")
      ? "degraded"
      : "ok";

  const body = {
    status: overall,
    service: "strike",
    version: APP_VERSION,
    uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    response_time_ms: Date.now() - startedAt,
    checks,
  };

  // Always 200 — the body contains the actual status. Use 503 if fully down
  // so monitoring tools can pick it up.
  return NextResponse.json(body, {
    status: overall === "down" ? 503 : 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
