"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import { SpotMap } from "@/components/spot-map";
import { SpotCard } from "@/components/spot-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Input } from "@/components/ui/input";

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function SpotsBrowser({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const { loading, error, reports, preferences, refresh } = useApp();
  const [query, setQuery] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(favoritesOnly);

  const visible = useMemo(() => {
    const needle = fold(query.trim());
    return reports.filter((report) => {
      if (onlyFavorites && !preferences.favoriteIds.includes(report.beach.id)) return false;
      if (!needle) return true;
      const haystack = fold(`${report.beach.name} ${report.beach.locality} ${report.beach.council}`);
      return haystack.includes(needle);
    });
  }, [onlyFavorites, preferences.favoriteIds, query, reports]);

  if (loading && reports.length === 0) return <LoadingState />;
  if (error && reports.every((report) => !report.forecast.marineOk)) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-4xl text-navy">{favoritesOnly ? "Favoritas" : "Praias"}</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          {favoritesOnly
            ? "As praias que guardaste, com a previsão desta consulta."
            : "Procura pelo nome ou percorre o mapa. Cada praia tem a sua orientação, não um molde único."}
        </p>
      </header>
      {!favoritesOnly ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Carcavelos, Cascais, Caparica…"
            aria-label="Procurar praia"
            className="h-11"
          />
          <button
            type="button"
            onClick={() => setOnlyFavorites((value) => !value)}
            className={`h-11 rounded-xl px-4 text-sm ring-1 ${onlyFavorites ? "bg-navy text-primary-foreground ring-navy" : "ring-foreground/15"}`}
          >
            Só favoritas
          </button>
        </div>
      ) : null}
      <SpotMap reports={visible.length > 0 ? visible : reports} />
      {visible.length === 0 ? (
        <EmptyState
          title={favoritesOnly || onlyFavorites ? "Sem praias guardadas" : "Nenhuma praia com esse nome"}
          body={
            favoritesOnly || onlyFavorites
              ? "Guarda uma praia no mapa ou na lista. Carcavelos, Guincho e Costa da Caparica são um bom começo."
              : "Experimenta o concelho, como Cascais ou Sintra, ou limpa a pesquisa."
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((report) => (
            <SpotCard key={report.beach.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
