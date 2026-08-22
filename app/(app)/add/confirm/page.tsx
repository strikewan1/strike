import { ConfirmForm } from "@/components/add/confirm-form";

export default async function AddConfirmPage() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Paso 2 de 2
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Revisá y corregí
        </h1>
        <p className="text-sm text-muted mt-1">
          La IA hizo su mejor intento. Ajustá lo que quieras antes de guardar.
        </p>
      </header>

      <ConfirmForm />
    </div>
  );
}
