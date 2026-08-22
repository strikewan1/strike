import { ReferenceUploadForm } from "@/components/inspire/reference-upload-form";

export default async function NewReferencePage() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Nueva referencia
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Agregar referencia
        </h1>
        <p className="text-sm text-muted mt-1">
          La IA va a analizar colores, siluetas y estilo.
        </p>
      </header>

      <ReferenceUploadForm />
    </div>
  );
}
