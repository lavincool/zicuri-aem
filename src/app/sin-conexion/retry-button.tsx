"use client";

import { Button } from "@/components/ui/button";

export function RetryButton({ label }: { label: string }) {
  return (
    <Button
      onClick={() => window.location.assign("/")}
      className="h-12 rounded-full px-6 text-base font-bold"
    >
      {label}
    </Button>
  );
}
