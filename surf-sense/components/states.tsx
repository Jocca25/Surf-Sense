import { Button } from "@/components/ui/button";

export function LoadingState({ label = "A ler o mar…" }: { label?: string }) {
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="h-56 animate-pulse rounded-3xl bg-navy/10" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
        <div className="h-28 animate-pulse rounded-2xl bg-white/70" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-3xl bg-paper px-6 py-10 ring-1 ring-foreground/10">
      <p className="font-serif text-3xl text-navy">O mar não respondeu</p>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{message}</p>
      <p className="mt-2 text-sm text-muted-foreground">Não mostro números inventados quando a previsão falha.</p>
      {onRetry ? (
        <Button className="mt-6 h-11 px-5" onClick={onRetry}>
          Tentar outra vez
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-foreground/15 px-6 py-10">
      <p className="font-serif text-2xl text-navy">{title}</p>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
