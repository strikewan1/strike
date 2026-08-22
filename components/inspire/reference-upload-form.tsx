"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

export function ReferenceUploadForm() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [analysis, setAnalysis] = useState<{
    items: Array<{ type: string; color: string; description: string }>;
    overall_style: string[];
    pairing_logic: string;
  } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const headerBuf = await file.slice(0, 16).arrayBuffer();
      const headerHex = Array.from(new Uint8Array(headerBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "references",
          fileName: file.name,
          contentType: file.type,
          headerHex,
        }),
      });
      if (!signRes.ok) {
        const errBody = await signRes.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Sign failed");
      }
      const { signedUrl, publicUrl } = await signRes.json();

      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");

      setImageUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!imageUrl) return;
    setAnalyzing(true);
    setError(null);
    try {
      // Read image as data URL for AI
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const analyzeRes = await fetch("/api/ai/analyze-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!analyzeRes.ok) throw new Error("Analysis failed");
      const result = await analyzeRes.json();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!imageUrl) return;
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { error } = await supabase.from("outfit_references").insert({
        user_id: user.id,
        image_url: imageUrl,
        source_url: sourceUrl || null,
        title: title || null,
        notes: notes || null,
        detected_items: analysis ?? null,
        style_tags: analysis?.overall_style ?? [],
      });
      if (error) throw error;
      router.push("/inspire");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  return (
    <div className="flex-1 px-6 pb-6 flex flex-col">
      <input
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        id="ref-upload"
      />

      {!imageUrl ? (
        <label
          htmlFor="ref-upload"
          className="aspect-square border-2 border-dashed border-border-strong flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-foreground transition-colors mb-6"
        >
          {uploading ? (
            <span className="text-sm text-muted">Subiendo…</span>
          ) : (
            <>
              <svg
                className="h-10 w-10 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="4" width="18" height="16" />
                <circle cx="9" cy="10" r="2" />
                <path d="M3 18L9 13L13 17L17 14L21 18" strokeLinejoin="round" />
              </svg>
              <span className="text-sm font-medium">Subir imagen</span>
              <span className="text-xs text-muted">screenshot, foto o URL</span>
            </>
          )}
        </label>
      ) : (
        <>
          <div className="aspect-square bg-surface-muted border border-border mb-4 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Referencia"
              className="w-full h-full object-contain"
            />
          </div>

          {!analysis && (
            <Button
              variant="outline"
              fullWidth
              loading={analyzing}
              onClick={handleAnalyze}
              className="mb-4"
            >
              {analyzing ? "Analizando…" : "Analizar con IA"}
            </Button>
          )}

          {analysis && (
            <div className="border border-border bg-surface p-3 mb-4 text-xs space-y-2">
              <p className="font-medium uppercase tracking-wider text-muted">
                Análisis
              </p>
              <ul className="space-y-1">
                {analysis.items.map((item, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{item.type}</span>: {item.description}{" "}
                    <span className="text-muted">({item.color})</span>
                  </li>
                ))}
              </ul>
              {analysis.pairing_logic && (
                <p className="text-sm leading-relaxed pt-2 border-t border-border">
                  {analysis.pairing_logic}
                </p>
              )}
            </div>
          )}

          <Input
            label="Título (opcional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Look SS25 Beams Plus"
          />
          <div className="h-3" />
          <Input
            label="URL de origen (opcional)"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Instagram, Pinterest, etc."
          />
          <div className="h-3" />
          <Textarea
            label="Notas"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="¿Qué te gusta de este look?"
          />
        </>
      )}

      {error && (
        <p className="text-sm text-danger mt-3" role="alert">
          {error}
        </p>
      )}

      <div className="mt-auto pt-6">
        <Button
          size="xl"
          fullWidth
          onClick={handleSave}
          disabled={!imageUrl}
        >
          Guardar referencia
        </Button>
      </div>
    </div>
  );
}
