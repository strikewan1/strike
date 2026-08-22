import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OutfitsPage() {
  return (
    <div className="flex flex-col">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Tu memoria de estilo
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">Outfits</h1>
      </header>

      <div className="px-6 pb-6 space-y-3">
        <Link href="/outfits/new" className="block">
          <Button fullWidth size="xl" variant="primary" className="justify-between">
            <span>¿Qué me pongo?</span>
            <span aria-hidden>→</span>
          </Button>
        </Link>
        <Link href="/outfits/build" className="block">
          <Button fullWidth size="lg" variant="outline" className="justify-between">
            <span>Build around my sneakers</span>
            <span aria-hidden>→</span>
          </Button>
        </Link>
        <Link href="/outfits/rotation" className="block">
          <Button fullWidth size="lg" variant="ghost" className="justify-between">
            <span>Sneaker rotation</span>
            <span aria-hidden>→</span>
          </Button>
        </Link>
        <Link href="/wishlist" className="block">
          <Button fullWidth size="lg" variant="ghost" className="justify-between">
            <span>Wishlist</span>
            <span aria-hidden>→</span>
          </Button>
        </Link>
        <p className="text-xs text-muted text-center pt-6">
          Tus outfits generados aparecerán acá.
        </p>
      </div>
    </div>
  );
}
