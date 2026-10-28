import { compassPhrase } from "@/lib/angles";
import type { Beach } from "@/lib/beaches";
import { CATEGORY_LABEL } from "@/lib/config";
import type { UserPreferences } from "@/lib/preferences";
import { SKILL_LABEL } from "@/lib/preferences";
import type { ScoredHour } from "@/lib/scoring";
import { formatHourLabel, formatMeters, formatSeconds } from "@/lib/time";
import type { DayPartSummary, SurfWindow, WindShift } from "@/lib/windows";
import { windKindLabel } from "@/lib/wind";

export interface ExplanationFacts {
  beachName: string;
  when: string;
  score: number | null;
  category: string | null;
  sizeM: number | null;
  directionDeg: number | null;
  periodS: number | null;
  windSpeedKmh: number | null;
  windKind: string | null;
  tideLabel: string | null;
  safety: string;
  confidence: string;
  sentences: string[];
}

/**
 * Turns the scoring result into plain sentences.
 * Every number comes from the forecast hour. Nothing here calls a language model.
 */
export function explainWindow(beach: Beach, surfWindow: SurfWindow): string {
  return explainWindowFacts(beach, surfWindow).sentences.join(" ");
}

export function explainWindowFacts(beach: Beach, surfWindow: SurfWindow): ExplanationFacts {
  const best = [...surfWindow.hours].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const start = formatHourLabel(surfWindow.start);
  const end = formatHourLabel(surfWindow.endExclusive);
  const sentences: string[] = [];
  if (surfWindow.recommended) {
    sentences.push(`Melhor janela: ${start}–${end}.`);
  } else {
    sentences.push(
      `Período menos mau: ${start}–${end}. A pontuação fica abaixo do mínimo que definiste, por isso não é uma recomendação.`,
    );
  }

  if (best?.swellDirectionDeg != null && best.sizeM != null && best.swellPeriodS != null) {
    sentences.push(
      `A ondulação vem de ${compassPhrase(best.swellDirectionDeg)}, com cerca de ${formatMeters(best.sizeM)} m e período de ${formatSeconds(best.swellPeriodS)} s.`,
    );
  } else if (best?.sizeM != null) {
    sentences.push(
      `A altura ronda os ${formatMeters(best.sizeM)} m. Falta direção ou período, por isso esta leitura fica incompleta.`,
    );
  } else {
    sentences.push("Não há altura de onda nestas horas, por isso não dá para recomendar a janela.");
  }

  if (best?.windSpeedKmh != null && best.wind) {
    const speeds = surfWindow.hours
      .map((hour) => hour.windSpeedKmh)
      .filter((value): value is number => value != null);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    const speedText =
      Math.round(minSpeed) === Math.round(maxSpeed)
        ? `${Math.round(best.windSpeedKmh)} km/h`
        : `${Math.round(minSpeed)} a ${Math.round(maxSpeed)} km/h`;
    sentences.push(`O vento previsto é ${windKindLabel(best.wind.kind)}, com cerca de ${speedText}.`);
  } else {
    sentences.push("Não há vento fiável para estas horas.");
  }

  if (surfWindow.windChanges) {
    sentences.push("Dentro da janela o vento muda de carácter, por isso as condições não ficam estáveis.");
  }

  if (best?.tide) {
    sentences.push(`Maré estimada: ${best.tide.label}.`);
    if (best.tide.confidence === "low") {
      sentences.push("O sinal de maré é fraco, por isso esta parte é incerta.");
    }
  } else {
    sentences.push("Não há uma maré fiável para estas horas.");
  }

  if (best?.safety === "danger") {
    sentences.push(
      "Mesmo que a ondulação tenha boa direção, o risco é elevado. A pontuação não é uma garantia de segurança.",
    );
  } else if (best?.safety === "caution") {
    sentences.push("Há um motivo de precaução. Confirma o vento e o tamanho antes de entrar.");
  }

  if (best?.confidence !== "ok") {
    sentences.push("Parte dos dados está em falta ou é incerta, por isso esta leitura é menos segura.");
  }

  return {
    beachName: beach.name,
    when: `${start}–${end}`,
    score: surfWindow.averageScore,
    category: best?.category ? CATEGORY_LABEL[best.category] : null,
    sizeM: best?.sizeM ?? null,
    directionDeg: best?.swellDirectionDeg ?? null,
    periodS: best?.swellPeriodS ?? null,
    windSpeedKmh: best?.windSpeedKmh ?? null,
    windKind: best?.wind ? windKindLabel(best.wind.kind) : null,
    tideLabel: best?.tide?.label ?? null,
    safety: best?.safety ?? "ok",
    confidence: best?.confidence ?? "insufficient",
    sentences,
  };
}

export function explainDay(input: {
  beach: Beach;
  preferences: UserPreferences;
  parts: DayPartSummary[];
  shifts: WindShift[];
  bestWindow: SurfWindow | null;
  dayLabel: string;
}): string {
  const { beach, preferences, parts, shifts, bestWindow, dayLabel } = input;
  const sentences: string[] = [];
  const morning = parts.find((part) => part.part === "morning");
  const afternoon = parts.find((part) => part.part === "afternoon");
  const evening = parts.find((part) => part.part === "evening");

  if (bestWindow?.recommended) {
    sentences.push(
      `${dayLabel} em ${beach.name}, a janela mais alta vai das ${formatHourLabel(bestWindow.start)} às ${formatHourLabel(bestWindow.endExclusive)}, com ${bestWindow.averageScore}/100.`,
    );
  } else if (bestWindow) {
    sentences.push(
      `${dayLabel} em ${beach.name} não chega ao teu mínimo. O período menos mau é ${formatHourLabel(bestWindow.start)}–${formatHourLabel(bestWindow.endExclusive)}, com ${bestWindow.averageScore}/100.`,
    );
  } else {
    sentences.push(`${dayLabel} em ${beach.name} não há horas suficientes para escolher uma janela.`);
  }

  if (
    morning?.averageScore != null &&
    afternoon?.averageScore != null &&
    Math.abs(afternoon.averageScore - morning.averageScore) >= 8
  ) {
    const better = afternoon.averageScore > morning.averageScore ? "tarde" : "manhã";
    const worse = better === "tarde" ? "manhã" : "tarde";
    sentences.push(
      `A ${better} fica melhor do que a ${worse}: ${afternoon.averageScore > morning.averageScore ? afternoon.averageScore : morning.averageScore} contra ${afternoon.averageScore > morning.averageScore ? morning.averageScore : afternoon.averageScore}.`,
    );
  } else if (evening?.averageScore != null && afternoon?.averageScore != null && evening.averageScore + 8 < afternoon.averageScore) {
    sentences.push("Ao fim do dia a pontuação desce em relação à tarde.");
  }

  const firstShift = shifts.find((shift) => shift.from !== shift.to);
  if (firstShift) {
    sentences.push(
      `O vento muda por volta das ${formatHourLabel(firstShift.time)}, de ${windKindLabel(firstShift.from)} para ${windKindLabel(firstShift.to)}.`,
    );
  }

  if (preferences.skill === "beginner" && bestWindow?.hours.some((hour) => (hour.sizeM ?? 0) >= 1.5)) {
    sentences.push(
      `Para um nível ${SKILL_LABEL.beginner.toLowerCase()}, o tamanho previsto pode ser exigente demais.`,
    );
  }

  return sentences.join(" ");
}

export function explainScore(hour: ScoredHour, beach: Beach): string {
  if (hour.score == null) {
    const missing = hour.missing.length ? hour.missing.join(", ") : "dados essenciais";
    return `Não há pontuação para esta hora porque falta: ${missing}.`;
  }
  const bits = [
    `${beach.name} fica com ${hour.score}/100 (${hour.category ? CATEGORY_LABEL[hour.category].toLowerCase() : "sem faixa"}).`,
  ];
  if (hour.cappedForSafety && hour.waveQuality != null) {
    bits.push(
      `A forma da onda, antes do travão de segurança, estava em ${hour.waveQuality}/100. Condições perigosas não são classificadas como excelentes.`,
    );
  }
  if (hour.suitabilityNote) bits.push(hour.suitabilityNote);
  const strongest = [...hour.factors].filter((factor) => factor.available).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const weakest = [...hour.factors].filter((factor) => factor.available).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
  if (strongest && weakest && strongest.key !== weakest.key) {
    bits.push(`O que mais ajuda é ${strongest.label.toLowerCase()}. O que mais tira é ${weakest.label.toLowerCase()}.`);
  }
  for (const note of hour.notes.slice(0, 2)) bits.push(note);
  if (hour.safety === "danger") {
    bits.push("Isto é uma previsão, não uma autorização para entrar na água.");
  }
  return bits.join(" ");
}
