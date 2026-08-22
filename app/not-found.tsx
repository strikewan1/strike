import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-3">
        Strike
      </span>
      <h1 className="text-4xl font-medium tracking-tight mb-2">404</h1>
      <p className="text-sm text-muted mb-6 max-w-xs">
        Esta página no existe o se perdió en el lavado.
      </p>
      <Link href="/">
        <Button variant="outline">Volver al inicio</Button>
      </Link>
    </div>
  );
}
