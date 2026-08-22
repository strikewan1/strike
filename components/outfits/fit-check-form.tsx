"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const RATINGS = [
  { value: "love" as const, emoji: "❤️", label: "Me encantó" },
  { value: "works" as const, emoji: "👍", label: "Funcionó" },
  { value: "meh" as const, emoji: "😐", label: "Regular" },
  { value: "fail" as const, emoji: "👎", label: "No funcionó" },
];

export function FitCheckForm({ outfitId }: { outfitId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const headerBuf = await file.slice(0, 16).arrayBuffer();
      const headerHex = Array.from(new Uint8Array(headerBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "fit-checks",
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

      setPhotoUrl(publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const { error } = await supabase.from("fit_checks").insert({
        user_id: user.id,
        outfit_id: outfitId,
        photo_url: photoUrl,
        rating,
        context: context || null,
      });
      if (error) throw error;

      // Update style_preferences based on rating
      if (rating === "love" || rating === "fail") {
        await fetch("/api/style/update-from-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ outfitId, rating }),
        });
      }

      router.refresh();
      setRating(null);
      setPhotoUrl(null);
      setContext("");
      toast.success("Feedback guardado. Gracias.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Photo upload */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
        id="fit-check-photo"
      />
      <label
        htmlFor="fit-check-photo"
        className="block aspect-video bg-surface-muted border border-dashed border-border-strong cursor-pointer hover:border-foreground transition-colors overflow-hidden"
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Fit check"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-muted">
            {uploading ? (
              <span className="text-xs">Subiendo…</span>
            ) : (
              <>
                <svg
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M3 8H7L9 6H15L17 8H21V20H3V8Z" strokeLinejoin="round" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                <span className="text-xs">Subí foto del look</span>
              </>
            )}
          </div>
        )}
      </label>

      {/* Ratings */}
      <div className="grid grid-cols-4 gap-2">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRating(r.value)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-3 border transition-colors",
              rating === r.value
                ? "bg-foreground text-background border-foreground"
                : "bg-transparent border-border hover:border-foreground",
            )}
          >
            <span className="text-2xl">{r.emoji}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider">
              {r.label}
            </span>
          </button>
        ))}
      </div>

      <textarea
        placeholder="Algo que quieras recordar…"
        value={context}
        onChange={(e) => setContext(e.target.value)}
        className="w-full bg-surface border border-border p-3 text-sm resize-none focus:outline-none focus:border-foreground"
        rows={2}
      />

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <Button onClick={handleSubmit} loading={saving} disabled={!rating} fullWidth>
        Guardar feedback
      </Button>
    </div>
  );
}
