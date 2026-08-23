"use client";

// Image editor modal that runs BEFORE upload. Lets the user crop,
// rotate, flip, and apply a white background to a selected garment
// photo. Output is a normalized PNG data URL ready for the existing
// upload + AI recognition pipeline.
//
// Why this exists: bulk uploads (~50 garments) require uniform
// visual presentation. Letting users re-crop every photo to a similar
// shape + white background produces a much more consistent closet.

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";

const ROTATION_STEP = 90;

interface ImageEditorProps {
  /** Source image as a data URL or remote URL. */
  imageDataUrl: string;
  /** Called with the edited PNG data URL when the user confirms. */
  onSave: (editedDataUrl: string) => void;
  /** Called when the user cancels — no save, just close. */
  onCancel: () => void;
}

/**
 * Compute the cropped canvas (optionally with white background)
 * from a source image. Returns the canvas ready to be exported.
 *
 * Uses html2canvas-style pixel math but does it natively via the
 * canvas API — no extra dependencies.
 */
async function renderCropped(
  source: HTMLImageElement,
  area: Area,
  rotation: number,
  applyWhiteBackground: boolean,
  flipH: boolean,
): Promise<HTMLCanvasElement> {
  // Rotation in degrees, snapped to nearest 90° increments.
  const snapped = Math.round(rotation / ROTATION_STEP) * ROTATION_STEP;
  const rad = (snapped * Math.PI) / 180;

  // Working canvas dimensions in the source image's coordinate space.
  // When the image is rotated 90/270°, the bounding box swaps.
  const isRotated = snapped % 180 !== 0;
  const baseW = isRotated ? source.naturalHeight : source.naturalWidth;
  const baseH = isRotated ? source.naturalWidth : source.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = baseW;
  canvas.height = baseH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Always fill with white first — if applyWhiteBackground is off,
  // we'll paint over it later, but the default is the uniform
  // editorial look.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Translate to the center, rotate, then translate back so rotation
  // pivots around the image center.
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  // Horizontal flip is applied here (around the post-rotation center).
  if (flipH) ctx.scale(-1, 1);
  ctx.drawImage(
    source,
    -source.naturalWidth / 2,
    -source.naturalHeight / 2,
  );

  // Now crop the rotated/painted canvas to the user's area. Note
  // that area coords are in the FINAL canvas space (post-rotation),
  // so we read directly from the same canvas.
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = Math.max(1, Math.round(area.width));
  finalCanvas.height = Math.max(1, Math.round(area.height));
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) throw new Error("Canvas 2D context unavailable");

  // Apply white background to the FINAL cropped canvas first, then
  // composite the cropped source over it. This ensures transparency
  // (PNG with alpha) becomes solid white in the output.
  if (applyWhiteBackground) {
    finalCtx.fillStyle = "#ffffff";
    finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  }

  finalCtx.drawImage(
    canvas,
    Math.round(area.x),
    Math.round(area.y),
    finalCanvas.width,
    finalCanvas.height,
    0,
    0,
    finalCanvas.width,
    finalCanvas.height,
  );

  return finalCanvas;
}

/**
 * Load an image source URL into an HTMLImageElement, resolving on
 * load and rejecting on error. We use this in renderCropped.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

export function ImageEditor({
  imageDataUrl,
  onSave,
  onCancel,
}: ImageEditorProps) {
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache the loaded image element so we don't reload on every render.
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageReady, setImageReady] = useState(false);

  // Lazy-load the image when the component mounts.
  useEffect(() => {
    let cancelled = false;
    loadImage(imageDataUrl)
      .then((img) => {
        if (cancelled) return;
        setLoadedImage(img);
        setImageReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load image");
      });
    return () => {
      cancelled = true;
    };
  }, [imageDataUrl]);

  const handleRotate = (degrees: number) => {
    setRotation((r) => (r + degrees) % 360);
    // Reset zoom slightly on rotation since orientation changes.
    setZoom((z) => Math.max(0.8, Math.min(3, z)));
  };

  const handleFlip = () => {
    setFlipH((f) => !f);
  };

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) {
      setError("Hacé el crop antes de guardar");
      return;
    }
    if (!loadedImage) {
      setError("Imagen no está lista");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const canvas = await renderCropped(
        loadedImage,
        croppedAreaPixels,
        rotation,
        true, // applyWhiteBackground is always on per product decision
        flipH,
      );
      const dataUrl = canvas.toDataURL("image/png");
      onSave(dataUrl);
    } catch (err) {
      console.error("[image-editor] save failed:", err);
      setError(
        err instanceof Error ? err.message : "No se pudo procesar la imagen",
      );
      setSaving(false);
    }
  }, [croppedAreaPixels, rotation, flipH, onSave, loadedImage]);

  return (
    <div
      className="fixed inset-0 z-50 bg-foreground/90 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Editar imagen"
    >
      <div className="bg-background w-full max-w-4xl max-h-[90vh] flex flex-col border border-border">
        <header className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-medium tracking-tight">
            Ajustar imagen
          </h2>
          <p className="text-xs text-muted">
            Fondo blanco uniforme • Listo para subir
          </p>
        </header>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_240px] min-h-0">
          {/* Cropper area */}
          <div className="relative bg-foreground/5 min-h-[400px] md:min-h-0">
            {imageReady ? (
              <Cropper
                image={imageDataUrl}
                crop={{ x: 0, y: 0 }}
                zoom={zoom}
                rotation={rotation}
                aspect={undefined}
                onCropChange={() => {
                  /* Cropper requires this even if we don't use it */
                }}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={(_, area) => setCroppedAreaPixels(area)}
                style={{
                  containerStyle: {
                    backgroundColor: "transparent",
                  },
                  // Apply horizontal flip via CSS scaleX(-1). The library
                  // doesn't accept a `flip` prop on this version.
                  mediaStyle: flipH
                    ? ({ transform: "scaleX(-1)" } as never)
                    : undefined,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted">
                {error ?? "Cargando imagen…"}
              </div>
            )}
          </div>

          {/* Controls sidebar */}
          <aside className="bg-surface border-t md:border-t-0 md:border-l border-border p-4 space-y-4 overflow-y-auto">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                Rotación
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRotate(-ROTATION_STEP)}
                  aria-label="Rotar 90 grados a la izquierda"
                >
                  ↺ Izq
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRotate(ROTATION_STEP)}
                  aria-label="Rotar 90 grados a la derecha"
                >
                  Der ↻
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                Flipear
              </p>
              <Button
                variant={flipH ? "primary" : "outline"}
                size="sm"
                fullWidth
                onClick={handleFlip}
                aria-pressed={flipH}
              >
                {flipH ? "✓ Flip horizontal" : "Flip horizontal"}
              </Button>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                Zoom
              </p>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-foreground"
                aria-label="Zoom level"
              />
              <p className="text-xs text-muted text-center mt-1">
                {Math.round(zoom * 100)}%
              </p>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted italic">
                Fondo blanco se aplica siempre. Usá zoom y crop para
                encuadrar bien la prenda.
              </p>
            </div>
          </aside>
        </div>

        {error && (
          <div className="px-6 py-2 bg-danger/10 border-t border-danger/30">
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          </div>
        )}

        <footer className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!imageReady}>
            Guardar y continuar
          </Button>
        </footer>
      </div>
    </div>
  );
}
