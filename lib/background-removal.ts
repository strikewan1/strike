"use client";

// Background removal client-side wrapper using @imgly/background-removal.
// Models are downloaded once and cached by the browser.

import { removeBackground, type Config } from "@imgly/background-removal";

const CONFIG: Config = {
  // output PNG to keep transparency
  output: { format: "image/png", quality: 0.92 },
  // Use the fastest quantized model; smaller download, runs on CPU
  model: "isnet_quint8",
  debug: false,
};

let preloaded = false;

export async function preloadRemovalModel(): Promise<void> {
  if (preloaded) return;
  const { preload } = await import("@imgly/background-removal");
  await preload(CONFIG);
  preloaded = true;
}

export async function removeBackgroundFromBlob(blob: Blob): Promise<Blob> {
  return removeBackground(blob, CONFIG);
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function removeBackgroundFromDataUrl(
  dataUrl: string,
): Promise<Blob> {
  const blob = await dataUrlToBlob(dataUrl);
  return removeBackgroundFromBlob(blob);
}
