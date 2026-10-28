import type { Beach } from "@/lib/beaches";
import type { UserPreferences } from "@/lib/preferences";
import type { ScoredHour } from "@/lib/scoring";
import { formatHourLabel, formatMeters, isQuietHour, zonedHour, zonedLocalToUtc } from "@/lib/time";
import type { SurfWindow } from "@/lib/windows";

export interface SentAlert {
  id: string;
  fingerprint: string;
  sentAt: string;
}

export interface AlertCandidate {
  id: string;
  fingerprint: string;
  spotId: string;
  spotName: string;
  start: string;
  endExclusive: string;
  score: number;
  waveHeightM: number;
  windSpeedKmh: number;
  summary: string;
  forecastIssuedAt: string;
  /** Always a forecast. Never an observation. */
  kind: "forecast";
  update: boolean;
}

export type AlertDecision =
  | { action: "send"; alert: AlertCandidate }
  | { action: "skip"; spotId: string; reason: SkipReason }
  | { action: "defer"; spotId: string; reason: "quiet-hours"; alert: AlertCandidate };

export type SkipReason =
  | "opt-out"
  | "not-selected"
  | "stale"
  | "uncertain"
  | "missing-data"
  | "safety"
  | "below-score"
  | "wave-range"
  | "wind"
  | "too-far"
  | "already-passed"
  | "duplicate"
  | "no-window";

export interface AlertForecast {
  beach: Beach;
  hours: ScoredHour[];
  windows: SurfWindow[];
  stale: boolean;
  uncertain: boolean;
  forecastIssuedAt: string;
}

export function alertId(spotId: string, start: string): string {
  return `${spotId}|${start.slice(0, 13)}`;
}

export function alertFingerprint(surfWindow: SurfWindow): string {
  const score = Math.round(surfWindow.averageScore / 5) * 5;
  const wave = representativeWave(surfWindow);
  const wind = representativeWind(surfWindow);
  const kind = surfWindow.hours.find((hour) => hour.wind)?.wind?.kind ?? "none";
  return `${score}|${wave.toFixed(1)}|${Math.round(wind / 5) * 5}|${kind}`;
}

export function evaluateAlerts(input: {
  now: Date;
  preferences: UserPreferences;
  forecasts: AlertForecast[];
  alreadySent: SentAlert[];
}): AlertDecision[] {
  const settings = input.preferences.notifications;
  if (!settings.enabled) {
    return input.forecasts.map((forecast) => ({
      action: "skip",
      spotId: forecast.beach.id,
      reason: "opt-out",
    }));
  }

  const selected = new Set(
    settings.spotIds.length > 0 ? settings.spotIds : input.preferences.favoriteIds,
  );
  const quiet = isQuietHour(
    zonedHour(input.now, "Europe/Lisbon"),
    settings.quietStartHour,
    settings.quietEndHour,
  );
  const decisions: AlertDecision[] = [];

  for (const forecast of input.forecasts) {
    if (!selected.has(forecast.beach.id)) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "not-selected" });
      continue;
    }
    if (forecast.stale) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "stale" });
      continue;
    }
    if (forecast.uncertain) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "uncertain" });
      continue;
    }

    const window = pickWindow(forecast.windows, input.now, forecast.beach.timezone, settings.leadHours);
    if (!window) {
      const anyFuture = forecast.windows.some((item) => windowEndsAfter(item, input.now, forecast.beach.timezone));
      decisions.push({
        action: "skip",
        spotId: forecast.beach.id,
        reason: anyFuture ? "too-far" : "no-window",
      });
      continue;
    }
    if (!windowEndsAfter(window, input.now, forecast.beach.timezone)) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "already-passed" });
      continue;
    }
    if (window.hours.some((hour) => hour.safety === "danger")) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "safety" });
      continue;
    }
    if (window.averageScore < settings.minScore || !window.recommended) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "below-score" });
      continue;
    }
    if (!windowComplete(window)) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "missing-data" });
      continue;
    }
    const wave = representativeWave(window);
    const wind = representativeWind(window);
    if (wave < settings.waveMinM || wave > settings.waveMaxM) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "wave-range" });
      continue;
    }
    if (wind > settings.maxWindKmh) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "wind" });
      continue;
    }

    const id = alertId(forecast.beach.id, window.start);
    const fingerprint = alertFingerprint(window);
    const previous = input.alreadySent.find((sent) => sent.id === id);
    if (previous && previous.fingerprint === fingerprint) {
      decisions.push({ action: "skip", spotId: forecast.beach.id, reason: "duplicate" });
      continue;
    }

    const alert = buildAlert(forecast, window, id, fingerprint, previous != null);
    if (quiet) {
      decisions.push({ action: "defer", spotId: forecast.beach.id, reason: "quiet-hours", alert });
      continue;
    }
    decisions.push({ action: "send", alert });
  }

  return decisions;
}

function pickWindow(windows: SurfWindow[], now: Date, timeZone: string, leadHours: number): SurfWindow | null {
  const horizon = now.getTime() + leadHours * 60 * 60 * 1000;
  const eligible = windows.filter((item) => {
    const start = zonedLocalToUtc(item.start, timeZone).getTime();
    return start <= horizon && windowEndsAfter(item, now, timeZone);
  });
  return eligible.sort((a, b) => b.averageScore - a.averageScore)[0] ?? null;
}

function windowEndsAfter(item: SurfWindow, now: Date, timeZone: string): boolean {
  return zonedLocalToUtc(item.endExclusive, timeZone).getTime() > now.getTime();
}

function windowComplete(item: SurfWindow): boolean {
  return item.hours.every(
    (hour) =>
      hour.confidence === "ok" &&
      hour.sizeM != null &&
      hour.windSpeedKmh != null &&
      hour.windDirectionDeg != null &&
      hour.swellDirectionDeg != null &&
      hour.tide != null &&
      hour.tide.confidence === "ok",
  );
}

function representativeWave(item: SurfWindow): number {
  const values = item.hours.map((hour) => hour.sizeM).filter((value): value is number => value != null);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function representativeWind(item: SurfWindow): number {
  const values = item.hours.map((hour) => hour.windSpeedKmh).filter((value): value is number => value != null);
  if (values.length === 0) return 0;
  return Math.max(...values);
}

function buildAlert(
  forecast: AlertForecast,
  surfWindow: SurfWindow,
  id: string,
  fingerprint: string,
  update: boolean,
): AlertCandidate {
  const wave = representativeWave(surfWindow);
  const wind = representativeWind(surfWindow);
  const when = `${formatHourLabel(surfWindow.start)} e as ${formatHourLabel(surfWindow.endExclusive)}`;
  const prefix = update ? "Atualização da previsão. " : "";
  return {
    id,
    fingerprint,
    spotId: forecast.beach.id,
    spotName: forecast.beach.name,
    start: surfWindow.start,
    endExclusive: surfWindow.endExclusive,
    score: surfWindow.averageScore,
    waveHeightM: Number(wave.toFixed(2)),
    windSpeedKmh: Math.round(wind),
    summary: `${prefix}Boas condições previstas em ${forecast.beach.name} entre as ${when}. Pontuação prevista: ${surfWindow.averageScore}/100. Ondulação cerca de ${formatMeters(wave)} m e vento até ${Math.round(wind)} km/h. Isto é uma previsão, não uma observação.`,
    forecastIssuedAt: forecast.forecastIssuedAt,
    kind: "forecast",
    update,
  };
}
