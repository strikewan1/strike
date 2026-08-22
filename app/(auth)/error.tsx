"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AuthError]", error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-2xl font-medium tracking-tight mb-2">
        No pudimos continuar
      </h1>
      <p className="text-sm text-muted mb-6 max-w-xs">
        Hubo un problema. Reintentá o volvé al inicio de sesión.
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
        <Link href="/login">
          <Button variant="primary">Volver al login</Button>
        </Link>
      </div>
    </div>
  );
}
