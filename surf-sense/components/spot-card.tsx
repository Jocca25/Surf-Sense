"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { ScoreMark } from "@/components/charts";
import type { SpotReport } from "@/lib/report";
import { formatHourLabel, formatMeters } from "@/lib/time";
import { windKindShort } from "@/lib/wind";

export function SpotCard({ report, compact = false }: { report: SpotReport; compact?: boolean }) {
  const { preferences, toggleFavorite } = useApp();
  const current = report.current;
  const favorite = preferences.favoriteIds.includes(report.beach.id);
  const window = report.windows[0];
  return (
    <article className="relative flex flex-col rounded-3xl bg-paper p-4 ring-1 ring-foreground/10">
      <Link
        href={`/praias/${report.beach.id}`}
        aria-label={`Abrir ${report.beach.name}`}
        className="absolute inset-0 z-10 rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocean"
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{report.beach.council}</p>
          <p className="font-serif text-2xl text-navy">{report.beach.name}</p>
        </div>
        <button
          type="button"
          aria-pressed={favorite}
          aria-label={favorite ? `Tirar ${report.beach.name} das favoritas` : `Guardar ${report.beach.name}`}
          onClick={() => toggleFavorite(report.beach.id)}
          className="relative z-20 -mr-1 flex size-11 items-center justify-center rounded-full text-navy"
        >
          <Heart className={`size-5 ${favorite ? "fill-navy" : ""}`} />
        </button>
      </div>
      {report.forecast.marineOk ? (
        <>
          <div className="mt-3">
            <ScoreMark score={current?.score ?? null} category={current?.category ?? null} />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Onda</dt>
              <dd>{current?.sizeM != null ? `${formatMeters(current.sizeM)} m` : "–"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vento</dt>
              <dd>{current?.wind ? windKindShort(current.wind.kind) : "–"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Maré</dt>
              <dd>{current?.tide?.label ?? "–"}</dd>
            </div>
          </dl>
          {!compact && window ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {window.recommended ? "Janela" : "Período menos mau"}: {formatHourLabel(window.start)}–
              {formatHourLabel(window.endExclusive)} · {window.averageScore}/100
            </p>
          ) : null}
          {report.forecast.stale ? (
            <p className="mt-2 text-xs text-fair">Leitura antiga. A atualização falhou.</p>
          ) : null}
        </>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{report.forecast.error}</p>
      )}
    </article>
  );
}
