"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { ScoreMark } from "@/components/charts";
import { SpotCard } from "@/components/spot-card";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { getBeach } from "@/lib/beaches";
import type { SpotReport } from "@/lib/report";
import { formatClock, formatHourLabel, formatLongDate, greetingForHour, zonedHour } from "@/lib/time";
import type { SurfWindow } from "@/lib/windows";

export function Dashboard() {
  const { loading, error, reports, preferences, changes, inbox, refresh, fetchedAt, now, quietNow } = useApp();
  const [wall, setWall] = useState<Date | null>(null);
  useEffect(() => {
    setWall(new Date());
  }, []);
  if (loading && reports.length === 0) {
    return (
      <div className="space-y-8">
        <DashboardHeader when={wall} />
        <LoadingState label="A pedir a previsão do mar e do vento. A primeira abertura pode levar alguns segundos." />
      </div>
    );
  }
  if (error && reports.every((report) => !report.forecast.marineOk)) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  const favourites = reports.filter((report) => preferences.favoriteIds.includes(report.beach.id));
  const pool = favourites.length > 0 ? favourites : reports;
  const best = pickBest(pool) ?? pickBest(reports);
  const ranked = [...reports].sort((a, b) => (b.current?.score ?? -1) - (a.current?.score ?? -1));
  const warnings = reports.flatMap((report) =>
    report.forecast.warnings
      .filter((warning) => warning.awarenessLevelID === "orange" || warning.awarenessLevelID === "red")
      .map((warning) => ({ spot: report.beach.name, warning })),
  );

  return (
    <div className="space-y-8">
      <DashboardHeader when={now} />

      {best ? (
        <section className="relative overflow-hidden rounded-[2rem] bg-navy px-6 py-7 text-primary-foreground md:px-8">
          <p className="text-xs tracking-[0.18em] text-white/60 uppercase">
            {best.window.recommended ? "Melhor janela à vista" : "Melhor período disponível"}
          </p>
          <h2 className="font-serif mt-3 text-4xl md:text-5xl">{best.report.beach.name}</h2>
          <p className="mt-2 text-white/80">
            {formatHourLabel(best.window.start)}–{formatHourLabel(best.window.endExclusive)} · {best.window.averageScore}/100
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">
            {best.report.windowText}
          </p>
          {!best.window.recommended ? (
            <p className="mt-3 text-sm text-sand">Isto fica abaixo do mínimo que definiste.</p>
          ) : null}
          <div className="mt-6">
            <Button
              variant="secondary"
              className="h-11 px-4"
              nativeButton={false}
              render={<Link href={`/praias/${best.report.beach.id}`} />}
            >
              Ver a praia
            </Button>
          </div>
          <svg viewBox="0 0 400 40" className="pointer-events-none absolute right-0 bottom-0 w-64 opacity-40" aria-hidden>
            <path d="M0 24c40-16 80-16 120 0s80 16 120 0 80-16 120 0 40 16 80 0" fill="none" stroke="#f4efe4" strokeWidth="1.5" />
          </svg>
        </section>
      ) : (
        <section className="rounded-[2rem] bg-paper p-6 ring-1 ring-foreground/10">
          <p className="font-serif text-3xl text-navy">Ainda sem uma janela</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Não há horas com dados suficientes para escolher um período.
          </p>
        </section>
      )}

      {warnings.length > 0 ? (
        <section className="rounded-3xl bg-[#f8ebe3] px-5 py-4 text-sm text-[#6d2e28] ring-1 ring-[#8d3d3d]/20">
          <p className="font-medium">Avisos oficiais do IPMA</p>
          <ul className="mt-2 space-y-1">
            {warnings.slice(0, 4).map((item) => (
              <li key={`${item.spot}-${item.warning.startTime}-${item.warning.awarenessTypeName}`}>
                {item.spot}: aviso {item.warning.awarenessLevelID === "red" ? "vermelho" : "laranja"} de {item.warning.awarenessTypeName}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-2xl text-navy">As tuas praias</h2>
          <Link href="/favoritos" className="text-sm text-ocean">
            Gerir
          </Link>
        </div>
        {favourites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda não guardaste praias. Começa por Carcavelos, Costa da Caparica ou Guincho.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {favourites.map((report) => (
              <SpotCard key={report.beach.id} report={report} compact />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <h2 className="font-serif text-2xl text-navy">Agora na costa</h2>
          <ol className="mt-3 divide-y divide-foreground/10 rounded-3xl bg-paper ring-1 ring-foreground/10">
            {ranked.map((report, index) => (
              <li key={report.beach.id}>
                <Link href={`/praias/${report.beach.id}`} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-5 text-sm text-muted-foreground">{index + 1}</span>
                  <span className="flex-1 font-medium">{report.beach.name}</span>
                  <ScoreMark score={report.current?.score ?? null} category={report.current?.category ?? null} compact />
                </Link>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
            <h2 className="font-serif text-2xl text-navy">Desde a última leitura</h2>
            {changes.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Ainda não há uma leitura anterior para comparar, ou a pontuação manteve-se.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {changes.map((change) => (
                  <li key={change.spotId}>
                    {getBeach(change.spotId)?.name ?? change.spotId}{" "}
                    {change.delta > 0 ? "subiu" : "desceu"} {Math.abs(change.delta)} pontos, para {change.after}.
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
            <h2 className="font-serif text-2xl text-navy">Alertas</h2>
            {quietNow ? <p className="mt-2 text-sm text-fair">Hora de silêncio. Os alertas ficam para depois.</p> : null}
            {inbox[0] ? (
              <p className="mt-2 text-sm leading-relaxed">{inbox[0].summary}</p>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {preferences.notifications.enabled
                  ? "Nenhum alerta novo. Só aviso quando a previsão encaixa no que pediste."
                  : "Os alertas estão desligados. Nada é enviado até os ligares."}
              </p>
            )}
            <Link href="/alertas" className="mt-3 inline-block text-sm text-ocean">
              Definições de alerta
            </Link>
          </div>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {fetchedAt ? `Consulta feita às ${formatClock(new Date(fetchedAt), "Europe/Lisbon")} (Lisboa). ` : ""}
        Ondas e vento: Open-Meteo. Avisos: IPMA. Isto é previsão, não o mar que vês da areia.
      </p>
    </div>
  );
}

function DashboardHeader({ when }: { when: Date | null }) {
  return (
    <header>
      <p className="text-sm text-muted-foreground">
        {when
          ? `${greetingForHour(zonedHour(when, "Europe/Lisbon"))} · ${formatLongDate(when, "Europe/Lisbon")}`
          : "Costa de Lisboa"}
      </p>
      <h1 className="font-serif mt-1 text-4xl text-navy md:text-5xl">O mar, hora a hora</h1>
    </header>
  );
}

function pickBest(reports: SpotReport[]): { report: SpotReport; window: SurfWindow } | null {
  const pairs = reports.flatMap((report) => report.windows.map((surfWindow) => ({ report, window: surfWindow })));
  const recommended = pairs.filter((pair) => pair.window.recommended);
  const pool = recommended.length > 0 ? recommended : pairs;
  return pool.sort((a, b) => b.window.averageScore - a.window.averageScore)[0] ?? null;
}
