"use client";

import { useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { HourlyChart, ScoreMark, TideChart, WindDial } from "@/components/charts";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { beachOrientationSentence } from "@/lib/beaches";
import { CATEGORY_LABEL } from "@/lib/config";
import { explainScore, explainWindow } from "@/lib/explanations";
import { compassPhrase } from "@/lib/angles";
import { formatClock, formatDayLabel, formatHourLabel, formatMeters, formatSeconds } from "@/lib/time";
import { windKindShort } from "@/lib/wind";

export function SpotDetail({ spotId }: { spotId: string }) {
  const { loading, reports, preferences, toggleFavorite, refresh, now } = useApp();
  const report = reports.find((item) => item.beach.id === spotId);
  const [day, setDay] = useState<string | null>(null);
  const [hour, setHour] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeDay = day ?? report?.days[0]?.date ?? null;
  const dayHours = useMemo(
    () => report?.hours.filter((item) => item.time.startsWith(activeDay ?? "none")) ?? [],
    [report, activeDay],
  );
  const selected = dayHours.find((item) => item.time === hour) ?? report?.current ?? dayHours[0] ?? null;

  if (loading && !report) return <LoadingState label={`A abrir ${spotId}…`} />;
  if (!report) return <ErrorState message="Esta praia não está na lista." />;

  const favorite = preferences.favoriteIds.includes(report.beach.id);
  const current = selected;
  const dayExtremes = report.forecast.tide.extremes.filter((extreme) => extreme.time.startsWith(activeDay ?? ""));

  async function sendFeedback() {
    if (!rating || !current) return;
    setFeedback(null);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spotId, sessionTime: current.time, rating, note }),
    });
    const payload = (await response.json()) as { message?: string };
    setFeedback(payload.message ?? (response.ok ? "Nota guardada." : "Não foi possível guardar."));
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {report.beach.locality} · {report.beach.council}
          </p>
          <h1 className="font-serif text-4xl text-navy md:text-6xl">{report.beach.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{report.beach.summary}</p>
        </div>
        <button
          type="button"
          onClick={() => toggleFavorite(report.beach.id)}
          aria-pressed={favorite}
          className="rounded-full bg-paper p-3 ring-1 ring-foreground/10"
          aria-label={favorite ? "Tirar das favoritas" : "Guardar praia"}
        >
          <Heart className={`size-5 ${favorite ? "fill-navy text-navy" : "text-navy"}`} />
        </button>
      </header>

      {!report.forecast.marineOk ? (
        <ErrorState message={report.forecast.error ?? "Sem previsão para esta praia."} onRetry={refresh} />
      ) : (
        <>
          {report.forecast.stale ? (
            <p className="rounded-2xl bg-[#f8ebe3] px-4 py-3 text-sm text-[#6d2e28]">
              Esta leitura foi guardada de uma consulta anterior e pode estar desatualizada.
            </p>
          ) : null}
          {report.forecast.uncertaintyNote ? (
            <p className="rounded-2xl bg-sand/50 px-4 py-3 text-sm">{report.forecast.uncertaintyNote}</p>
          ) : null}
          {current?.confidence === "partial" ? (
            <p className="text-sm text-fair">Faltam peças nesta hora. A pontuação usa só o que chegou.</p>
          ) : null}

          <section className="grid gap-4 rounded-[2rem] bg-paper p-5 ring-1 ring-foreground/10 md:grid-cols-[auto_1fr] md:p-7">
            <ScoreMark score={current?.score ?? null} category={current?.category ?? null} large />
            <div>
              <p className="text-sm leading-relaxed">{current ? explainScore(current, report.beach) : "Sem hora selecionada."}</p>
              {current?.safety !== "ok" ? (
                <ul className="mt-3 space-y-1 text-sm text-poor">
                  {current?.safetyReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Altura"
              value={current?.sizeM != null ? `${formatMeters(current.sizeM)} m` : "Indisponível"}
              hint={current?.sizeSource === "wave" ? "Altura significativa, sem ondulação separada" : "Ondulação"}
            />
            <Stat
              label="Direção e período"
              value={
                current?.swellDirectionDeg != null
                  ? compassPhrase(current.swellDirectionDeg)
                  : "Direção em falta"
              }
              hint={current?.swellPeriodS != null ? `${formatSeconds(current.swellPeriodS)} s` : "Período em falta"}
            />
            <Stat
              label="Vento"
              value={
                current?.windSpeedKmh != null
                  ? `${Math.round(current.windSpeedKmh)} km/h`
                  : "Indisponível"
              }
              hint={
                current?.wind
                  ? `${windKindShort(current.wind.kind)}${current.windGustKmh != null ? ` · rajadas ${Math.round(current.windGustKmh)} km/h` : ""}`
                  : "Sem classificação"
              }
            />
            <Stat
              label="Maré"
              value={current?.tide ? current.tide.label : "Indisponível"}
              hint={report.forecast.tide.label}
            />
          </section>

          <section className="grid items-center gap-6 rounded-3xl bg-paper p-5 ring-1 ring-foreground/10 md:grid-cols-[auto_1fr]">
            <WindDial
              facing={report.beach.facingDeg}
              windFrom={current?.windDirectionDeg ?? null}
              kind={current?.wind?.kind ?? null}
            />
            <div>
              <h2 className="font-serif text-2xl text-navy">Vento e a costa</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {beachOrientationSentence(report.beach)} O vento conta de onde vem, não para onde vai.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                O sector verde é de terra. O sector suave é de mar. A linha mostra para onde o vento sopra.
              </p>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-navy">Dias</h2>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {report.days.map((item) => (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => {
                    setDay(item.date);
                    setHour(null);
                  }}
                  className={`min-w-28 rounded-2xl px-3 py-3 text-left ring-1 ${
                    item.date === activeDay ? "bg-navy text-primary-foreground ring-navy" : "bg-paper ring-foreground/10"
                  }`}
                >
                  <span className="block text-xs opacity-70">{formatDayLabel(item.date, now, "Europe/Lisbon")}</span>
                  <span className="font-serif text-2xl">{item.bestScore ?? "–"}</span>
                  <span className="block text-xs opacity-80">
                    {item.minWave != null && item.maxWave != null
                      ? `${formatMeters(item.minWave)}–${formatMeters(item.maxWave)} m`
                      : "sem altura"}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-paper p-4 ring-1 ring-foreground/10 md:p-5">
            <h2 className="font-serif text-2xl text-navy">Horas</h2>
            <div className="mt-3">
              <HourlyChart hours={dayHours} selected={current?.time ?? null} onSelect={setHour} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {(report.days.find((item) => item.date === activeDay)?.parts ?? []).map((part) => (
              <div key={part.part} className="rounded-3xl bg-paper p-4 ring-1 ring-foreground/10">
                <p className="text-sm text-muted-foreground">{part.label}</p>
                <p className="font-serif text-3xl text-navy">{part.averageScore ?? "–"}</p>
                <p className="text-sm text-muted-foreground">
                  {part.passed ? "Já passou. " : ""}
                  {part.bestTime ? `Melhor hora ${formatHourLabel(part.bestTime)}.` : "Sem horas com pontuação."}
                </p>
              </div>
            ))}
          </section>

          <section>
            <h2 className="font-serif text-2xl text-navy">Janelas</h2>
            <div className="mt-3 space-y-3">
              {report.windows.filter((item) => item.start.startsWith(activeDay ?? "")).length === 0 ? (
                <p className="text-sm text-muted-foreground">Neste dia não há uma janela acima do teu mínimo.</p>
              ) : null}
              {report.windows
                .filter((item) => item.start.startsWith(activeDay ?? ""))
                .map((item) => (
                  <article key={item.start} className="rounded-3xl bg-paper p-4 ring-1 ring-foreground/10">
                    <p className="text-sm text-muted-foreground">
                      {item.recommended ? "Recomendada" : "Abaixo do teu mínimo"} · {item.averageScore}/100
                    </p>
                    <p className="font-serif text-2xl text-navy">
                      {formatHourLabel(item.start)}–{formatHourLabel(item.endExclusive)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed">{explainWindow(report.beach, item)}</p>
                  </article>
                ))}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{report.narrative}</p>
          </section>

          <section className="rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
            <h2 className="font-serif text-2xl text-navy">Maré</h2>
            <p className="mt-1 text-sm text-muted-foreground">{report.forecast.tide.limitation}</p>
            <div className="mt-4">
              <TideChart
                hours={dayHours.map((item) => ({ time: item.time, level: item.tide?.levelM ?? null }))}
                extremes={dayExtremes}
                datum={report.forecast.tide.datum}
              />
            </div>
          </section>

          <section>
            <h2 className="font-serif text-2xl text-navy">Porque é que a pontuação é esta</h2>
            <ul className="mt-3 space-y-3">
              {(current?.factors ?? []).map((factor) => (
                <li key={factor.key}>
                  <div className="flex justify-between text-sm">
                    <span>{factor.label}</span>
                    <span>{factor.available ? factor.score : "em falta"}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-ocean"
                      style={{ width: `${factor.score ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{factor.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          {report.forecast.warnings.length > 0 ? (
            <section>
              <h2 className="font-serif text-2xl text-navy">Avisos do IPMA</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {report.forecast.warnings.map((warning) => (
                  <li key={`${warning.awarenessTypeName}-${warning.startTime}`} className="rounded-2xl bg-paper p-3 ring-1 ring-foreground/10">
                    {warning.awarenessTypeName} · {warning.awarenessLevelID}
                    {warning.text ? ` — ${warning.text}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">Sem aviso amarelo, laranja ou vermelho do IPMA para esta zona nesta consulta.</p>
          )}

          {report.shifts.length > 0 ? (
            <section>
              <h2 className="font-serif text-2xl text-navy">Mudanças de vento hoje</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {report.shifts.map((shift) => (
                  <li key={shift.time}>
                    {formatHourLabel(shift.time)}: de {windKindShort(shift.from)} ({Math.round(shift.fromSpeed)} km/h) para {windKindShort(shift.to)} ({Math.round(shift.toSpeed)} km/h).
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section className="rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl text-navy">A praia</h2>
        <p className="mt-2 text-sm">{beachOrientationSentence(report.beach)}</p>
        <p className="mt-2 text-sm text-muted-foreground">Fundo: {report.beach.bottom}.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {report.beach.hazards.map((hazard) => (
            <li key={hazard} className="rounded-full bg-muted px-3 py-1 text-xs">
              {hazard}
            </li>
          ))}
        </ul>
        {current?.seaTemperatureC != null ? (
          <p className="mt-3 text-sm">Água à superfície, cerca de {formatMeters(current.seaTemperatureC)} °C. É previsão do modelo, não um termómetro na praia.</p>
        ) : null}
      </section>

      <section className="rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl text-navy">Como estava o mar?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A tua nota fica guardada para o futuro. Não muda a pontuação de hoje e não treina nenhum modelo.
        </p>
        <div className="mt-3 flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className={`size-10 rounded-full ring-1 ${rating === value ? "bg-navy text-primary-foreground ring-navy" : "ring-foreground/15"}`}
            >
              {value}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          placeholder="Uma frase, se quiseres."
          className="mt-3 min-h-20 w-full rounded-2xl border border-input bg-transparent px-3 py-2 text-sm"
        />
        <Button className="mt-3 h-10 px-4" disabled={!rating} onClick={() => void sendFeedback()}>
          Guardar nota
        </Button>
        {feedback ? <p className="mt-2 text-sm">{feedback}</p> : null}
      </section>

      <footer className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        <p>
          A pontuação não é uma garantia de segurança. Confirma o mar no local e os{" "}
          <a className="underline" href="https://www.ipma.pt/pt/maritima/avisos/index.jsp">
            avisos do IPMA
          </a>{" "}
          antes de entrar na água. A tabela oficial de marés é a do{" "}
          <a className="underline" href="https://www.hidrografico.pt/">
            Instituto Hidrográfico
          </a>
          .
        </p>
        <p>
          Consulta de {formatClock(new Date(report.forecast.fetchedAt), "Europe/Lisbon")}, hora de Lisboa.
          {current ? ` Hora em foco: ${formatHourLabel(current.time)} (${current.category ? CATEGORY_LABEL[current.category] : "sem faixa"}).` : ""}
        </p>
      </footer>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-3xl bg-paper p-4 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg leading-snug">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
