"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  blobToDataUrl,
  preloadRemovalModel,
  removeBackgroundFromBlob,
} from "@/lib/background-removal";
import { ImageEditor } from "@/components/add/image-editor";

type Status =
  | "idle"
  | "preloading"
  | "captured"
  | "processing"
  | "uploading"
  | "recognizing"
  | "ready"
  | "error";

export function CaptureForm({ source }: { source: "camera" | "gallery" }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);

  // Initialize camera (only when source === "camera")
  useEffect(() => {
    if (source !== "camera") return;
    let cancelled = false;

    const start = async () => {
      try {
        setStatus("preloading");
        // Preload the BG-removal model in parallel with camera startup
        const preloadPromise = preloadRemovalModel().catch(() => {
          // Non-fatal
        });

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraStarted(true);
        }

        await preloadPromise;
        setStatus("idle");
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error ? err.message : "No pudimos acceder a la cámara",
        );
        setStatus("error");
      }
    };

    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [source]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(dataUrl);

    // Stop camera
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Open the editor so the user can crop/rotate/flip before upload.
    setPendingImage(dataUrl);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await blobToDataUrl(file);
    setPreview(dataUrl);

    // Open the editor so the user can crop/rotate/flip before upload.
    setPendingImage(dataUrl);
  };

  // Helper: request a signed upload URL for a specific path.
  // Defined before processImage so it's available when called.
  const requestSignedUrl = async (
    fileName: string,
    contentType: string,
    blobForMagicBytes: Blob,
  ): Promise<{
    signedUrl: string;
    path: string;
    token: string;
    publicUrl: string;
  }> => {
    const headerBuf = await blobForMagicBytes.slice(0, 16).arrayBuffer();
    const headerBytes = new Uint8Array(headerBuf);
    const headerHex = Array.from(headerBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    console.log(
      "[upload] POST /api/upload/sign fileName=", fileName,
      "contentType=", contentType, "headerHex=", headerHex.slice(0, 16) + "...",
    );
    let r: Response;
    try {
      r = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "garments",
          fileName,
          contentType,
          headerHex,
        }),
        cache: "no-store", // critical: don't let SW serve a stale response
      });
    } catch (networkErr) {
      console.error("[upload] /api/upload/sign network error:", networkErr);
      throw new Error(
        `Network error contacting server: ${networkErr instanceof Error ? networkErr.message : "unknown"}`,
      );
    }
    if (!r.ok) {
      const errBody = await r.json().catch(() => ({}));
      throw new Error(errBody.error ?? `Sign URL failed: HTTP ${r.status}`);
    }
    return r.json();
  };

  // Helper: PUT a blob to a signed URL.
  // Uses Supabase's native uploadToSignedUrl() which handles all the
  // header/auth edge cases. Raw fetch PUT to the signedUrl was failing
  // with "Object not found" because Supabase's signing format includes
  // auth requirements the raw fetch couldn't satisfy.
  const putToSignedUrl = async (
    bucket: string,
    path: string,
    token: string,
    blob: Blob,
  ): Promise<void> => {
    console.log(
      "[upload] uploadToSignedUrl bucket=", bucket,
      "path=", path, "size=", blob.size,
      "type=", blob.type,
    );
    const supabase = createClient();
    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(path, token, blob, {
        contentType: blob.type,
      });
    if (error) {
      console.error("[upload] uploadToSignedUrl error:", error);
      throw new Error(error.message ?? "Upload failed");
    }
  };

  const processImage = async (dataUrl: string) => {
    try {
      // ─── Step 1: Parse input ────────────────────────────────────────
      setStatus("processing");
      const mimeMatch = dataUrl.match(/^data:([^;]+);/);
      const inputMime = mimeMatch?.[1] || "image/jpeg";
      console.log("[upload] step=parse mime=", inputMime, "dataUrlLen=", dataUrl.length);

      // ─── Step 2: Build the original blob from the data URL ──────────
      // NOTE: We previously did `await fetch(dataUrl)` here. That failed
      // because modern browsers (Chrome 96+) apply CSP `connect-src` to
      // data URL fetches, and our CSP didn't include `data:`. To avoid
      // that policy entirely we decode the base64 directly — no network
      // round-trip, no CSP check, no fetch failure.
      const [, base64 = ""] = dataUrl.split(",");
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const originalBlob = new Blob([bytes], { type: inputMime });
      console.log("[upload] step=originalBlob size=", originalBlob.size, "type=", originalBlob.type);

      // ─── Step 3: Background removal (best-effort) ───────────────────
      let cleanedBlob: Blob = originalBlob;
      try {
        cleanedBlob = await removeBackgroundFromBlob(originalBlob);
        console.log("[upload] step=bg-removal size=", cleanedBlob.size, "type=", cleanedBlob.type);
      } catch (bgErr) {
        console.warn("[upload] step=bg-removal FAILED, using original:", bgErr);
      }
      // Force PNG type for cleaned blob (library's documented default)
      if (!cleanedBlob.type || cleanedBlob.type === "text/plain") {
        cleanedBlob = new Blob([await cleanedBlob.arrayBuffer()], {
          type: "image/png",
        });
        console.log("[upload] step=bg-removal type-forced to image/png");
      }

      const cleanedDataUrl = await blobToDataUrl(cleanedBlob);

      setStatus("uploading");

      // ─── Step 4: Upload ORIGINAL via signed URL ────────────────────
      const origType = originalBlob.type || inputMime;
      console.log("[upload] step=sign-url-original mime=", origType);

      let originalUrl: string;
      try {
        const origSigned = await requestSignedUrl(
          "capture.jpg",
          origType,
          originalBlob,
        );
        console.log("[upload] step=sign-url-original OK path=", origSigned.path);
        await putToSignedUrl("garments", origSigned.path, origSigned.token, originalBlob);
        // Buckets are now public (migration 0003), so publicUrl works.
        originalUrl = origSigned.publicUrl;
        console.log("[upload] step=put-original OK url=", originalUrl);
      } catch (err) {
        console.error("[upload] step=upload-original FAILED:", err);
        const msg =
          err instanceof Error ? err.message : "Error subiendo original";
        throw new Error(
          `Subiendo imagen original: ${msg}. ` +
            `Si ves "Load failed" en DevTools, probablemente sea el Service ` +
            `Worker cacheado. Limpiá la cache del sitio (DevTools > Application > ` +
            `Storage > Clear site data) y recargá.`,
        );
      }

      // ─── Step 5: Upload CLEANED via signed URL ─────────────────────
      const cleanType = cleanedBlob.type || "image/png";
      console.log("[upload] step=sign-url-cleaned mime=", cleanType);

      let cleanedUrl: string;
      try {
        const cleanSigned = await requestSignedUrl(
          "capture-cleaned.jpg",
          cleanType,
          cleanedBlob,
        );
        console.log("[upload] step=sign-url-cleaned OK path=", cleanSigned.path);
        await putToSignedUrl("garments", cleanSigned.path, cleanSigned.token, cleanedBlob);
        cleanedUrl = cleanSigned.publicUrl;
        console.log("[upload] step=put-cleaned OK url=", cleanedUrl);
      } catch (err) {
        console.error("[upload] step=upload-cleaned FAILED:", err);
        throw new Error(
          `Subiendo imagen procesada: ${err instanceof Error ? err.message : "Error"}`,
        );
      }

      // ─── Step 6: AI recognition ────────────────────────────────────
      setStatus("recognizing");
      console.log("[upload] step=ai-recognize sending dataUrl len=", cleanedDataUrl.length);
      let ai: unknown;
      try {
        const aiRes = await fetch("/api/ai/recognize-garment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: cleanedDataUrl }),
          cache: "no-store",
        });
        if (!aiRes.ok) {
          const errBody = await aiRes.json().catch(() => ({}));
          throw new Error(errBody.error ?? `AI HTTP ${aiRes.status}`);
        }
        ai = await aiRes.json();
        console.log("[upload] step=ai-recognize OK category=", (ai as { category?: string })?.category);
      } catch (err) {
        console.error("[upload] step=ai-recognize FAILED:", err);
        throw new Error(
          `Reconocimiento IA: ${err instanceof Error ? err.message : "Error"}`,
        );
      }

      setStatus("ready");

      // ─── Step 7: Persist to confirm-step ───────────────────────────
      sessionStorage.setItem(
        "strike:pending-garment",
        JSON.stringify({
          originalImageUrl: originalUrl,
          cleanedImageUrl: cleanedUrl,
          ai,
        }),
      );
      router.push("/add/confirm");
    } catch (err) {
      console.error("[upload] FINAL ERROR:", err);
      setError(err instanceof Error ? err.message : "Error procesando la imagen");
      setStatus("error");
    }
  };

  const retake = () => {
    setPreview(null);
    setStatus("idle");
    setError(null);
    if (source === "gallery") {
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      // Restart camera
      window.location.reload();
    }
  };

  // Image editor overlay — opens whenever a photo is selected.
  // Defined once so it can wrap either the gallery or camera view.
  const editor = pendingImage ? (
    <ImageEditor
      imageDataUrl={pendingImage}
      onCancel={() => {
        setPendingImage(null);
        setPreview(null);
      }}
      onSave={(editedDataUrl) => {
        setPendingImage(null);
        setPreview(editedDataUrl);
        void processImage(editedDataUrl);
      }}
    />
  ) : null;

  // Gallery view
  if (source === "gallery") {
    const gallery = (
      <div className="flex-1 px-6 pb-6 flex flex-col">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
          id="gallery-input"
        />
        {!preview && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <label
              htmlFor="gallery-input"
              className="w-full aspect-square max-w-sm border-2 border-dashed border-border-strong flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-foreground transition-colors"
            >
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
              <span className="text-sm font-medium">Elegir foto</span>
              <span className="text-xs text-muted">JPEG, PNG o HEIC</span>
            </label>
          </div>
        )}

        {preview && (
          <ProcessingPreview
            preview={preview}
            status={status}
            error={error}
            onRetake={retake}
          />
        )}
      </div>
    );
    return (
      <>
        {gallery}
        {editor}
      </>
    );
  }

  // Camera view
  const camera = (
    <div className="flex-1 px-4 pb-6 flex flex-col">
      {!preview ? (
        <>
          <div className="relative flex-1 bg-black overflow-hidden mb-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            {!cameraStarted && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                {status === "preloading"
                  ? "Preparando…"
                  : "Iniciando cámara…"}
              </div>
            )}
          </div>
          <Button
            size="xl"
            fullWidth
            onClick={handleCapture}
            disabled={!cameraStarted || status === "preloading"}
          >
            Capturar
          </Button>
        </>
      ) : (
        <ProcessingPreview
          preview={preview}
          status={status}
          error={error}
          onRetake={retake}
        />
      )}
    </div>
  );

  return (
    <>
      {camera}
      {editor}
    </>
  );
}

function ProcessingPreview({
  preview,
  status,
  error,
  onRetake,
}: {
  preview: string;
  status: Status;
  error: string | null;
  onRetake: () => void;
}) {
  const statusLabel: Record<Status, string> = {
    idle: "",
    preloading: "Preparando modelo…",
    captured: "Capturado",
    processing: "Limpiando fondo…",
    uploading: "Subiendo imagen…",
    recognizing: "Analizando prenda…",
    ready: "Listo",
    error: "Error",
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 bg-surface-muted border border-border overflow-hidden mb-4 relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt="Vista previa"
          className="w-full h-full object-contain"
        />
        {status !== "ready" && status !== "error" && (
          <div className="absolute inset-x-0 bottom-0 bg-foreground text-background text-xs px-4 py-3 flex items-center gap-3">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>{statusLabel[status]}</span>
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-danger mb-3" role="alert">
          {error}
        </p>
      )}
      {status === "error" && (
        <Button variant="outline" fullWidth onClick={onRetake}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
