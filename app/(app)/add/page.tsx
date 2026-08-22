import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AddPage() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-6 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Sumá a tu closet
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          + Agregar
        </h1>
        <p className="text-sm text-muted mt-1">
          Lo registramos en menos de 20 segundos.
        </p>
      </header>

      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 gap-3">
          <Link href="/add/camera" className="block">
            <Button fullWidth size="xl" variant="primary" className="justify-between">
              <span>Tomar foto</span>
              <CameraIcon />
            </Button>
          </Link>
          <Link href="/add/gallery" className="block">
            <Button fullWidth size="xl" variant="outline" className="justify-between">
              <span>Elegir de galería</span>
              <GalleryIcon />
            </Button>
          </Link>
          <Link href="/inspire/new" className="block">
            <Button fullWidth size="xl" variant="ghost" className="justify-between">
              <span>Agregar referencia</span>
              <BookmarkIcon />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-5 w-5"
    >
      <path d="M3 8H7L9 6H15L17 8H21V20H3V8Z" strokeLinejoin="round" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function GalleryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-5 w-5"
    >
      <rect x="3" y="4" width="18" height="16" rx="0" />
      <circle cx="9" cy="10" r="2" />
      <path d="M3 18L9 13L13 17L17 14L21 18" strokeLinejoin="round" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-5 w-5"
    >
      <path
        d="M6 4H18V21L12 17L6 21V4Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}
