"use client";

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "bg-foreground text-background border border-foreground shadow-none rounded-none font-sans text-sm",
          description: "text-background/70",
          actionButton: "bg-background text-foreground",
          cancelButton: "bg-background/20 text-background",
          error: "bg-danger text-white border-danger",
          success: "bg-success text-white border-success",
          warning: "bg-warning text-white border-warning",
        },
      }}
      richColors
      closeButton
    />
  );
}
