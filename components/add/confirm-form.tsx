"use client";

import { useState, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChipGroup } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import type { GarmentKind, Season, SneakerProminence } from "@/lib/supabase/types";
import type { RecognizedGarment } from "@/lib/ai/schemas";
import {
  TOP_SUBCATEGORIES,
  BOTTOM_SUBCATEGORIES,
  OUTERWEAR_SUBCATEGORIES,
  FOOTWEAR_SUBCATEGORIES,
  ACCESSORY_SUBCATEGORIES,
  TOP_FITS,
  BOTTOM_FITS,
  PATTERNS,
  MATERIALS,
  COLOR_FAMILIES,
  STYLE_TAGS,
} from "@/lib/ai/schemas";

interface PendingGarment {
  originalImageUrl: string;
  cleanedImageUrl: string;
  ai: RecognizedGarment;
}

const KIND_OPTIONS: Array<{ value: GarmentKind; label: string }> = [
  { value: "garment", label: "Prenda" },
  { value: "sneaker", label: "Sneaker" },
  { value: "accessory", label: "Accesorio" },
];

const SEASON_OPTIONS: Array<{ value: Season; label: string }> = [
  { value: "spring", label: "Primavera" },
  { value: "summer", label: "Verano" },
  { value: "fall", label: "Otoño" },
  { value: "winter", label: "Invierno" },
  { value: "all", label: "Todo el año" },
];

const PROMINENCE_OPTIONS: Array<{ value: SneakerProminence; label: string }> = [
  { value: "neutral", label: "Neutral" },
  { value: "icon", label: "Icon" },
  { value: "statement", label: "Statement" },
];

interface FormState {
  kind: GarmentKind;
  subcategory: string;
  brand: string;
  primaryColor: string;
  fit: string;
  pattern: string;
  material: string;
  seasons: Season[];
  formality: number;
  styleTags: string[];
  favorite: boolean;
  sneakerModel: string;
  sneakerColorway: string;
  sneakerSilhouette: string;
  sneakerProminence: SneakerProminence;
  notes: string;
}

function deriveInitialState(data: PendingGarment): FormState {
  return {
    kind: data.ai.kind,
    subcategory: data.ai.subcategory,
    brand: data.ai.brand_guess ?? "",
    primaryColor: data.ai.primary_color,
    fit: data.ai.fit ?? "",
    pattern: data.ai.pattern,
    material: data.ai.material ?? "",
    seasons: data.ai.seasons as Season[],
    formality: data.ai.formality,
    styleTags: data.ai.style_tags,
    favorite: false,
    sneakerModel: data.ai.sneaker?.model_guess ?? "",
    sneakerColorway: data.ai.sneaker?.colorway ?? "",
    sneakerSilhouette: data.ai.sneaker?.silhouette ?? "",
    sneakerProminence: data.ai.sneaker?.prominence ?? "neutral",
    notes: "",
  };
}

function loadPending(): PendingGarment | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem("strike:pending-garment");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingGarment;
  } catch {
    return null;
  }
}

export function ConfirmForm() {
  const router = useRouter();
  const [pending] = useState<PendingGarment | null>(() => loadPending());
  const [form, dispatch] = useReducer(
    (
      state: FormState,
      action: Partial<FormState> | { type: "reset"; state: FormState },
    ): FormState => {
      if ("type" in action && action.type === "reset") return action.state;
      return { ...state, ...action };
    },
    pending ?? undefined,
    (init?: PendingGarment): FormState =>
      init ? deriveInitialState(init) : deriveInitialState({
        originalImageUrl: "",
        cleanedImageUrl: "",
        ai: {
          kind: "garment",
          category: "top",
          subcategory: "",
          fit: null,
          primary_color: "white",
          secondary_colors: [],
          pattern: "solid",
          material: null,
          seasons: [],
          formality: 2,
          style_tags: [],
          brand_guess: null,
          sneaker: null,
          confidence_notes: null,
        },
      }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect if no pending data — uses ref to avoid setState in effect
  useEffect(() => {
    if (!pending) {
      router.replace("/add");
    }
  }, [pending, router]);

  if (!pending) {
    return (
      <div className="px-6 text-sm text-muted">Cargando datos…</div>
    );
  }

  const {
    kind,
    subcategory,
    brand,
    primaryColor,
    fit,
    pattern,
    material,
    seasons,
    formality,
    styleTags,
    favorite,
    sneakerModel,
    sneakerColorway,
    sneakerSilhouette,
    sneakerProminence,
    notes,
  } = form;

  // Subcategory options based on kind/category
  const subcategoryOptions = (() => {
    if (kind === "sneaker") return FOOTWEAR_SUBCATEGORIES;
    if (kind === "accessory") return ACCESSORY_SUBCATEGORIES;
    switch (pending.ai.category) {
      case "top":
        return TOP_SUBCATEGORIES;
      case "bottom":
        return BOTTOM_SUBCATEGORIES;
      case "outerwear":
        return OUTERWEAR_SUBCATEGORIES;
      case "footwear":
        return FOOTWEAR_SUBCATEGORIES;
      default:
        return [] as readonly string[];
    }
  })();

  const fitOptions =
    pending.ai.category === "bottom" ? BOTTOM_FITS : TOP_FITS;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const payload = {
        user_id: user.id,
        kind,
        original_image_url: pending.originalImageUrl,
        cleaned_image_url: pending.cleanedImageUrl,
        category: pending.ai.category,
        subcategory: subcategory || null,
        fit: fit || null,
        primary_color: primaryColor || null,
        secondary_colors: pending.ai.secondary_colors ?? [],
        pattern,
        material: material || null,
        seasons,
        formality,
        style_tags: styleTags,
        brand: brand || null,
        favorite,
        ai_recognized: true,
        ai_confidence: pending.ai.confidence_notes
          ? { note: pending.ai.confidence_notes }
          : null,
        ...(kind === "sneaker" && {
          sneaker_model: sneakerModel || null,
          sneaker_colorway: sneakerColorway || null,
          sneaker_silhouette: sneakerSilhouette || null,
          sneaker_prominence: sneakerProminence,
        }),
        notes: notes || null,
      };

      const { error } = await supabase.from("garments").insert(payload);
      if (error) throw error;

      sessionStorage.removeItem("strike:pending-garment");
      router.push("/closet");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 px-6 pb-6">
      {/* Image preview */}
      <div className="aspect-square bg-surface-muted border border-border mb-6 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pending.cleanedImageUrl}
          alt="Prenda normalizada"
          className="w-full h-full object-contain"
        />
      </div>

      {/* Kind picker */}
      <section className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
          Tipo
        </p>
        <ChipGroup
          options={KIND_OPTIONS}
          value={kind}
          onChange={(v) => dispatch({ kind: v as GarmentKind })}
        />
      </section>

      {/* Classification */}
      <section className="space-y-4 mb-6">
        <Select
          label="Categoría específica"
          value={subcategory}
          onChange={(e) => dispatch({ subcategory: e.target.value })}
          options={subcategoryOptions.map((s) => ({
            value: s,
            label: s.replace(/_/g, " "),
          }))}
          placeholder="Elegí una subcategoría"
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Fit"
            value={fit}
            onChange={(e) => dispatch({ fit: e.target.value })}
            options={[
              { value: "", label: "—" },
              ...fitOptions.map((f) => ({ value: f, label: f })),
            ]}
            placeholder="—"
          />
          <Input
            label="Marca"
            value={brand}
            onChange={(e) => dispatch({ brand: e.target.value })}
            placeholder="opcional"
          />
        </div>

        <Select
          label="Color principal"
          value={primaryColor}
          onChange={(e) => dispatch({ primaryColor: e.target.value })}
          options={COLOR_FAMILIES.map((c) => ({ value: c, label: c }))}
          placeholder="Color principal"
        />

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Estampado"
            value={pattern}
            onChange={(e) => dispatch({ pattern: e.target.value })}
            options={PATTERNS.map((p) => ({ value: p, label: p }))}
          />
          <Select
            label="Material"
            value={material}
            onChange={(e) => dispatch({ material: e.target.value })}
            options={[
              { value: "", label: "—" },
              ...MATERIALS.map((m) => ({ value: m, label: m })),
            ]}
          />
        </div>
      </section>

      {/* Seasons */}
      <section className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
          Temporadas
        </p>
        <ChipGroup
          options={SEASON_OPTIONS}
          value={seasons}
          onChange={(v) => dispatch({ seasons: v as Season[] })}
          multiple
        />
      </section>

      {/* Formality */}
      <section className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
          Formalidad (0 casual → 5 formal)
        </p>
        <div className="flex gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => dispatch({ formality: i })}
              className={cn(
                "flex-1 h-10 border text-sm font-medium transition-colors",
                i === formality
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent border-border hover:border-foreground",
              )}
            >
              {i}
            </button>
          ))}
        </div>
      </section>

      {/* Style tags */}
      <section className="mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
          Estilo
        </p>
        <ChipGroup
          options={STYLE_TAGS.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
          value={styleTags}
          onChange={(v) => dispatch({ styleTags: v as string[] })}
          multiple
        />
      </section>

      {/* Sneaker-specific */}
      {kind === "sneaker" && (
        <section className="mb-6 space-y-4 border-t border-border pt-6">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Sneaker
          </p>
          <Input
            label="Modelo"
            value={sneakerModel}
            onChange={(e) => dispatch({ sneakerModel: e.target.value })}
            placeholder="Air Jordan 3"
          />
          <Input
            label="Colorway"
            value={sneakerColorway}
            onChange={(e) => dispatch({ sneakerColorway: e.target.value })}
            placeholder="White / Fire Red"
          />
          <Input
            label="Silueta"
            value={sneakerSilhouette}
            onChange={(e) => dispatch({ sneakerSilhouette: e.target.value })}
            placeholder="AJ3"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted mb-2">
              Prominencia
            </p>
            <ChipGroup
              options={PROMINENCE_OPTIONS}
              value={sneakerProminence}
              onChange={(v) => dispatch({ sneakerProminence: v as SneakerProminence })}
            />
          </div>
        </section>
      )}

      {/* Notes + favorite */}
      <section className="mb-6 space-y-4">
        <Textarea
          label="Notas (opcional)"
          value={notes}
          onChange={(e) => dispatch({ notes: e.target.value })}
          placeholder="Algo que quieras recordar…"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(e) => dispatch({ favorite: e.target.checked })}
            className="h-4 w-4 accent-foreground"
          />
          <span className="text-sm">Marcar como favorita</span>
        </label>
      </section>

      {error && (
        <p className="text-sm text-danger mb-4" role="alert">
          {error}
        </p>
      )}

      <Button size="xl" fullWidth onClick={handleSave} loading={saving}>
        Guardar en el closet
      </Button>
    </div>
  );
}
