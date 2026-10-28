import { angularDistance, compassPhrase } from "@/lib/angles";
import type { Beach } from "@/lib/beaches";
import { explainDay, explainWindow } from "@/lib/explanations";
import type { SpotForecast } from "@/lib/forecast/types";
import type { UserPreferences } from "@/lib/preferences";
import { scoreHour, type ScoredHour, type ScoringHourInput } from "@/lib/scoring";
import { formatMeters, utcToZonedLocalIso, zonedLocalToUtc } from "@/lib/time";
import { annotateTideLevels } from "@/lib/tides";
import { datesIn, findWindows, rollupDay, type DayRollup, type SurfWindow, type WindShift } from "@/lib/windows";

export interface SpotReport {
  beach: Beach;
  forecast: SpotForecast;
  hours: ScoredHour[];
  current: ScoredHour | null;
  windows: SurfWindow[];
  days: DayRollup[];
  shifts: WindShift[];
  narrative: string;
  windowText: string | null;
  secondarySwellNote: string | null;
}

export function buildSpotReport(
  beach: Beach,
  forecast: SpotForecast,
  preferences: UserPreferences,
  now: Date,
): SpotReport {
  const annotated = annotateTideLevels(
    forecast.hours.map((hour) => ({ time: hour.time, tideLevelM: hour.tideLevelM })),
    forecast.tide.extremes.length > 0 ? forecast.tide.extremes : null,
  );
  const warnings = forecast.warnings.map((warning) => ({
    awarenessTypeName: warning.awarenessTypeName,
    awarenessLevelID: warning.awarenessLevelID,
    text: warning.text,
    startTime: warning.startTime,
    endTime: warning.endTime,
  }));
  const hours = forecast.hours.map((hour) => {
    const input: ScoringHourInput = {
      time: hour.time,
      waveHeightM: hour.waveHeightM,
      waveDirectionDeg: hour.waveDirectionDeg,
      wavePeriodS: hour.wavePeriodS,
      swellHeightM: hour.swellHeightM,
      swellDirectionDeg: hour.swellDirectionDeg,
      swellPeriodS: hour.swellPeriodS,
      windWaveHeightM: hour.windWaveHeightM,
      windWaveDirectionDeg: hour.windWaveDirectionDeg,
      windWavePeriodS: hour.windWavePeriodS,
      windSpeedKmh: hour.windSpeedKmh,
      windDirectionDeg: hour.windDirectionDeg,
      windGustKmh: hour.windGustKmh,
      seaTemperatureC: hour.seaTemperatureC,
      tide: annotated.byTime.get(hour.time) ?? null,
    };
    const scored = scoreHour({
      beach,
      hour: input,
      preferences,
      warnings,
      marineUncertain: forecast.marineUncertain,
    });
    const secondary = secondaryNote(hour.secondarySwellHeightM, hour.secondarySwellDirectionDeg, hour.swellDirectionDeg);
    if (secondary) scored.notes.push(secondary);
    return scored;
  });

  const windows = forecast.marineOk ? findWindows(hours, now, beach.timezone, preferences.minScore) : [];
  const days = datesIn(hours).map((date) => rollupDay(hours, date, now, beach.timezone));
  const today = utcToZonedLocalIso(now, beach.timezone).slice(0, 10);
  const todayRollup = days.find((day) => day.date === today) ?? days[0];
  const bestWindow = windows[0] ?? null;
  const narrative = explainDay({
    beach,
    preferences,
    parts: todayRollup?.parts ?? [],
    shifts: todayRollup?.shifts ?? [],
    bestWindow,
    dayLabel: todayRollup ? (todayRollup.date === today ? "Hoje" : "Neste dia") : "Hoje",
  });

  return {
    beach,
    forecast,
    hours,
    current: pickCurrent(hours, now, beach.timezone),
    windows,
    days,
    shifts: todayRollup?.shifts ?? [],
    narrative,
    windowText: bestWindow ? explainWindow(beach, bestWindow) : null,
    secondarySwellNote: hours.find((hour) => hour.notes.some((note) => note.startsWith("Há uma ondulação secundária")))
      ?.notes.find((note) => note.startsWith("Há uma ondulação secundária")) ?? null,
  };
}

function secondaryNote(
  height: number | null,
  direction: number | null,
  primary: number | null,
): string | null {
  if (height == null || height < 0.4 || direction == null || primary == null) return null;
  if (angularDistance(direction, primary) < 40) return null;
  return `Há uma ondulação secundária de ${formatMeters(height)} m vinda de ${compassPhrase(direction)}. O mar pode ficar cruzado.`;
}

export function pickCurrent(hours: ScoredHour[], now: Date, timeZone: string): ScoredHour | null {
  if (hours.length === 0) return null;
  let chosen = hours[0];
  for (const hour of hours) {
    if (zonedLocalToUtc(hour.time, timeZone).getTime() <= now.getTime()) chosen = hour;
    else break;
  }
  return chosen;
}

export function nearTermScore(report: SpotReport, now: Date): number | null {
  const limit = now.getTime() + 12 * 60 * 60 * 1000;
  const upcoming = report.hours.filter((hour) => {
    const time = zonedLocalToUtc(hour.time, report.beach.timezone).getTime();
    return time >= now.getTime() - 60 * 60 * 1000 && time <= limit && hour.score != null;
  });
  if (upcoming.length === 0) return report.current?.score ?? null;
  return Math.max(...upcoming.map((hour) => hour.score ?? 0));
}
