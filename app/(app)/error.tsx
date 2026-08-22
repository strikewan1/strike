"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/bottom-nav";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
          Strike
        </span>
        <h1 className="text-2xl font-medium tracking-tight mb-2">
          Algo falló en esta vista
        </h1>
        <p className="text-sm text-muted mb-6 max-w-sm">
          No pudimos cargar esta pantalla. Tus datos están seguros.
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
          <Button onClick={() => router.push("/")} variant="primary">
            Ir al home
          </Button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
