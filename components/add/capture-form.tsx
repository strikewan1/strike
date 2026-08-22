"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  blobToDataUrl,
  preloadRemovalModel,
  removeBackgroundFromBlob,
} from "@/lib/background-removal";

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

    await processImage(dataUrl);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await blobToDataUrl(file);
    setPreview(dataUrl);
    await processImage(dataUrl);
  };

  const processImage = async (dataUrl: string) => {
    try {
      setStatus("processing");
      const base64Data = dataUrl.replace(/^data:[^;]+;base64,/, "");
      const response = await fetch(base64Data);
      const originalBlob = await response.blob();

      // Background removal (best-effort: if it fails, use original)
      let cleanedBlob: Blob = originalBlob;
      try {
        cleanedBlob = await removeBackgroundFromBlob(originalBlob);
      } catch (bgErr) {
        console.warn("BG removal failed, using original:", bgErr);
      }

      const cleanedDataUrl = await blobToDataUrl(cleanedBlob);

      setStatus("uploading");

      // Read first 16 bytes as hex for magic-byte verification server-side
      const headerBuf = await cleanedBlob.slice(0, 16).arrayBuffer();
      const headerBytes = new Uint8Array(headerBuf);
      const headerHex = Array.from(headerBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const uploadRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: "garments",
          fileName: "capture.jpg",
          contentType: cleanedBlob.type || "image/jpeg",
          headerHex,
        }),
      });
      if (!uploadRes.ok) {
        const errBody = await uploadRes.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Upload sign failed");
      }
      const { signedUrl, path, publicUrl } = await uploadRes.json();

      // Upload both original and cleaned
      const uploadFile = async (
        dataUrlToUpload: string,
        suffix: string,
      ): Promise<string> => {
        const blob = await (await fetch(dataUrlToUpload)).blob();
        const url = signedUrl.replace(
          path,
          path.replace(/\.[^.]+$/, `-${suffix}$&`),
        );
        const r = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": blob.type },
          body: blob,
        });
        if (!r.ok) throw new Error(`Upload ${suffix} failed`);
        return publicUrl.replace(
          path,
          path.replace(/\.[^.]+$/, `-${suffix}$&`),
        );
      };

      const originalUrl = await uploadFile(dataUrl, "original");
      const cleanedUrl = await uploadFile(cleanedDataUrl, "cleaned");

      setStatus("recognizing");
      const aiRes = await fetch("/api/ai/recognize-garment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: cleanedDataUrl }),
      });
      if (!aiRes.ok) {
        const errBody = await aiRes.json().catch(() => ({}));
        throw new Error(errBody.error ?? "AI recognition failed");
      }
      const ai = await aiRes.json();

      setStatus("ready");

      // Navigate to confirm step with state in session storage
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
      console.error(err);
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

  // Gallery view
  if (source === "gallery") {
    return (
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
  }

  // Camera view
  return (
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
