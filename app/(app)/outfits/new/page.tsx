import { NewOutfitForm } from "@/components/outfits/new-outfit-form";

export default async function NewOutfitPage() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Outfit engine
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          ¿Qué me pongo?
        </h1>
        <p className="text-sm text-muted mt-1">
          Contanos a dónde vas. Lo construimos con lo que ya tenés.
        </p>
      </header>

      <NewOutfitForm />
    </div>
  );
}
