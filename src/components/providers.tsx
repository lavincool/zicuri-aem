"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { ServiceWorker } from "@/components/service-worker";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
      <Toaster position="top-center" richColors closeButton />
      <ServiceWorker />
    </ThemeProvider>
  );
}
