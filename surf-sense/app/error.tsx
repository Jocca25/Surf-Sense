"use client";

import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-3xl bg-paper px-6 py-10 ring-1 ring-foreground/10">
      <h1 className="font-serif text-3xl text-navy">Esta página tropeçou</h1>
      <p className="mt-2 text-sm text-muted-foreground">Volta a tentar. Se a previsão falhou, não invento um número no lugar.</p>
      <Button className="mt-6 h-11 px-5" onClick={reset}>
        Tentar outra vez
      </Button>
    </div>
  );
}
