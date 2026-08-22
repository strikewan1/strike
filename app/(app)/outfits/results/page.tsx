import { OutfitResults } from "@/components/outfits/outfit-results";

export default async function OutfitResultsPage() {
  return (
    <div className="flex flex-col min-h-full">
      <header className="px-6 pt-10 pb-5 safe-top">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
          Sugerencias
        </span>
        <h1 className="text-3xl font-medium tracking-tight mt-2">
          Hoy podrías usar
        </h1>
        <p className="text-sm text-muted mt-1">
          Construido únicamente con tu closet.
        </p>
      </header>

      <OutfitResults />
    </div>
  );
}
