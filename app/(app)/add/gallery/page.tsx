import { CaptureForm } from "@/components/add/capture-form";

export default async function AddGalleryPage() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Paso 1 de 2
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Elegí la foto
        </h1>
        <p className="text-sm text-muted mt-1">
          La prenda tiene que verse clara, idealmente sobre fondo liso.
        </p>
      </header>

      <CaptureForm source="gallery" />
    </div>
  );
}
