"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { scoreClass } from "@/components/charts";
import { LoadingState } from "@/components/states";
import { formatHourLabel, formatMeters } from "@/lib/time";
import { windKindShort } from "@/lib/wind";

export function CompareView() {
  const { reports, loading, preferences } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("ids")?.split(",").filter(Boolean) ?? preferences.favoriteIds.slice(0, 3);
  const [selected, setSelected] = useState<string[]>(initial.slice(0, 3));

  const chosen = useMemo(
    () => selected.map((id) => reports.find((report) => report.beach.id === id)).filter((report) => report != null),
    [reports, selected],
  );

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : selected.length >= 3
        ? [...selected.slice(1), id]
        : [...selected, id];
    setSelected(next);
    router.replace(next.length ? `/comparar?ids=${next.join(",")}` : "/comparar");
  }

  if (loading && reports.length === 0) return <LoadingState />;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-4xl text-navy">Comparar</h1>
        <p className="mt-2 text-sm text-muted-foreground">Até três praias, na mesma hora e com a mesma régua.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {reports.map((report) => {
          const on = selected.includes(report.beach.id);
          return (
            <button
              key={report.beach.id}
              type="button"
              onClick={() => toggle(report.beach.id)}
              className={`rounded-full px-3 py-1.5 text-sm ring-1 ${on ? "bg-navy text-primary-foreground ring-navy" : "ring-foreground/15"}`}
            >
              {report.beach.name}
            </button>
          );
        })}
      </div>
      {chosen.length === 0 ? (
        <p className="text-sm text-muted-foreground">Escolhe pelo menos uma praia.</p>
      ) : (
        <div className="overflow-x-auto rounded-3xl bg-paper ring-1 ring-foreground/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="px-4 py-3 font-medium text-muted-foreground"> </th>
                {chosen.map((report) => (
                  <th key={report.beach.id} className="px-4 py-3 font-serif text-xl font-normal text-navy">
                    <Link href={`/praias/${report.beach.id}`}>{report.beach.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Pontuação agora">
                {chosen.map((report) => (
                  <td key={report.beach.id} className={`px-4 py-3 font-serif text-3xl ${scoreClass(report.current?.category ?? null)}`}>
                    {report.current?.score ?? "–"}
                  </td>
                ))}
              </Row>
              <Row label="Onda">
                {chosen.map((report) => (
                  <td key={report.beach.id} className="px-4 py-3">
                    {report.current?.sizeM != null ? `${formatMeters(report.current.sizeM)} m` : "Em falta"}
                  </td>
                ))}
              </Row>
              <Row label="Vento">
                {chosen.map((report) => (
                  <td key={report.beach.id} className="px-4 py-3">
                    {report.current?.windSpeedKmh != null
                      ? `${Math.round(report.current.windSpeedKmh)} km/h · ${report.current.wind ? windKindShort(report.current.wind.kind) : ""}`
                      : "Em falta"}
                  </td>
                ))}
              </Row>
              <Row label="Maré">
                {chosen.map((report) => (
                  <td key={report.beach.id} className="px-4 py-3">
                    {report.current?.tide?.label ?? "Em falta"}
                  </td>
                ))}
              </Row>
              <Row label="Melhor janela">
                {chosen.map((report) => (
                  <td key={report.beach.id} className="px-4 py-3">
                    {report.windows[0]
                      ? `${formatHourLabel(report.windows[0].start)}–${formatHourLabel(report.windows[0].endExclusive)} · ${report.windows[0].averageScore}`
                      : "Sem janela"}
                  </td>
                ))}
              </Row>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-foreground/5 last:border-0">
      <th className="px-4 py-3 font-medium text-muted-foreground">{label}</th>
      {children}
    </tr>
  );
}
