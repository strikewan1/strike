// This file configures the initialization of Sentry on the client (browser).
// Only initializes if SENTRY_DSN is exposed via NEXT_PUBLIC_SENTRY_DSN.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const tracesSampleRate = parseFloat(
  process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
);

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate,
    enableLogs: true,
  });
}
