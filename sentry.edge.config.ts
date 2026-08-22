// Edge runtime Sentry config. Only initializes if SENTRY_DSN is set.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
const tracesSampleRate = parseFloat(
  process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1",
);

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate,
  });
}
