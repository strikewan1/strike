"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
        Strike
      </span>
      <h1 className="text-3xl font-medium tracking-tight mb-2">
        Error inesperado
      </h1>
      <p className="text-sm text-muted mb-6 max-w-sm">
        Algo se rompió. Probá recargar o volvé al inicio.
      </p>
      {error.digest && (
        <p className="text-[10px] text-muted mb-4 font-mono">
          ID: {error.digest}
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          Reintentar
        </Button>
        <Link href="/">
          <Button variant="primary">Ir al inicio</Button>
        </Link>
      </div>
    </div>
  );
}
