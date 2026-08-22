// Next.js 16 instrumentation. Wires up Sentry if available.
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-only

export async function register() {
  // Only load Sentry if DSN is configured (zero cost otherwise)
  if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
    }
  }
}

// Required by Next.js when capturing errors that occur in React Server Components
export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[]>;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
    revalidateReason?: string;
    renderSource?: string;
  },
) {
  // Forward to Sentry if initialized
  if (process.env.SENTRY_DSN) {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(err, request, context);
  }
}
