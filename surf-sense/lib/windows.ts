import type { ScoredHour } from "@/lib/scoring";
import { addLocalHours, zonedLocalToUtc } from "@/lib/time";
import type { WindKind } from "@/lib/wind";

export interface SurfWindow {
  start: string;
  endExclusive: string;
  hours: ScoredHour[];
  averageScore: number;
  recommended: boolean;
  windChanges: boolean;
}

export interface DayPartSummary {
  part: "morning" | "afternoon" | "evening";
  label: string;
  averageScore: number | null;
  bestTime: string | null;
  passed: boolean;
  windLabel: string | null;
}

export interface WindShift {
  time: string;
  from: WindKind;
  to: WindKind;
  fromSpeed: number;
  toSpeed: number;
}

export interface DayRollup {
  date: string;
  minWave: number | null;
  maxWave: number | null;
  bestScore: number | null;
  bestTime: string | null;
  parts: DayPartSummary[];
  shifts: WindShift[];
}

const PARTS: { part: DayPartSummary["part"]; label: string; from: number; to: number }[] = [
  { part: "morning", label: "Manhã", from: 6, to: 12 },
  { part: "afternoon", label: "Tarde", from: 12, to: 18 },
  { part: "evening", label: "Fim do dia", from: 18, to: 22 },
];

export function findWindows(
  hours: ScoredHour[],
  now: Date,
  timeZone: string,
  minScore: number,
): SurfWindow[] {
  const upcoming = hours.filter((hour) => {
    if (hour.score == null) return false;
    const end = zonedLocalToUtc(hour.time, timeZone).getTime() + 60 * 60 * 1000;
    return end > now.getTime();
  });

  const windows: SurfWindow[] = [];
  let run: ScoredHour[] = [];
  const flush = () => {
    if (run.length === 0) return;
    windows.push(toWindow(bestSlice(run, 2, 4), true, timeZone));
    run = [];
  };

  for (const hour of upcoming) {
    if ((hour.score ?? 0) >= minScore && hour.confidence !== "insufficient") run.push(hour);
    else flush();
  }
  flush();

  if (windows.length === 0 && upcoming.some((hour) => hour.score != null)) {
    const slice = bestSlice(
      upcoming.filter((hour) => hour.score != null && hour.confidence !== "insufficient"),
      2,
      4,
    );
    if (slice.length > 0) windows.push(toWindow(slice, false, timeZone));
  }

  return windows.sort((a, b) => b.averageScore - a.averageScore || b.hours.length - a.hours.length).slice(0, 4);
}

function bestSlice(hours: ScoredHour[], minLength: number, maxLength: number): ScoredHour[] {
  if (hours.length <= maxLength) return hours;
  let best = hours.slice(0, Math.min(maxLength, hours.length));
  let bestAverage = average(best);
  const shortest = Math.min(minLength, hours.length);
  for (let length = shortest; length <= maxLength; length += 1) {
    for (let index = 0; index + length <= hours.length; index += 1) {
      const slice = hours.slice(index, index + length);
      const value = average(slice);
      if (value > bestAverage) {
        best = slice;
        bestAverage = value;
      }
    }
  }
  return best;
}

function toWindow(hours: ScoredHour[], recommended: boolean, timeZone: string): SurfWindow {
  const last = hours[hours.length - 1];
  const kinds = new Set(hours.map((hour) => hour.wind?.kind).filter(Boolean));
  return {
    start: hours[0].time,
    endExclusive: addLocalHours(last.time, 1, timeZone),
    hours,
    averageScore: Math.round(average(hours)),
    recommended,
    windChanges: kinds.size > 1,
  };
}

function average(hours: ScoredHour[]): number {
  if (hours.length === 0) return 0;
  return hours.reduce((sum, hour) => sum + (hour.score ?? 0), 0) / hours.length;
}

export function rollupDay(hours: ScoredHour[], date: string, now: Date, timeZone: string): DayRollup {
  const dayHours = hours.filter((hour) => hour.time.startsWith(date));
  const sizes = dayHours.map((hour) => hour.sizeM).filter((value): value is number => value != null);
  const scored = dayHours.filter((hour) => hour.score != null);
  const best = scored.reduce<ScoredHour | null>((winner, hour) => {
    if (!winner || (hour.score ?? 0) > (winner.score ?? 0)) return hour;
    return winner;
  }, null);
  const nowIso = now.getTime();
  return {
    date,
    minWave: sizes.length ? Math.min(...sizes) : null,
    maxWave: sizes.length ? Math.max(...sizes) : null,
    bestScore: best?.score ?? null,
    bestTime: best?.time ?? null,
    parts: PARTS.map((part) => {
      const partHours = dayHours.filter((hour) => {
        const clock = Number(hour.time.slice(11, 13));
        return clock >= part.from && clock < part.to;
      });
      const partScored = partHours.filter((hour) => hour.score != null);
      const bestPart = partScored.reduce<ScoredHour | null>((winner, hour) => {
        if (!winner || (hour.score ?? 0) > (winner.score ?? 0)) return hour;
        return winner;
      }, null);
      const passed =
        partHours.length > 0 &&
        partHours.every((hour) => zonedLocalToUtc(hour.time, timeZone).getTime() + 60 * 60 * 1000 <= nowIso);
      return {
        part: part.part,
        label: part.label,
        averageScore: partScored.length ? Math.round(average(partScored)) : null,
        bestTime: bestPart?.time ?? null,
        passed,
        windLabel: dominantWind(partHours),
      };
    }),
    shifts: windShifts(dayHours),
  };
}

function dominantWind(hours: ScoredHour[]): string | null {
  const counts = new Map<WindKind, number>();
  for (const hour of hours) {
    if (!hour.wind) continue;
    counts.set(hour.wind.kind, (counts.get(hour.wind.kind) ?? 0) + 1);
  }
  let winner: WindKind | null = null;
  let best = 0;
  for (const [kind, count] of counts) {
    if (count > best) {
      winner = kind;
      best = count;
    }
  }
  return winner;
}

export function windShifts(hours: ScoredHour[]): WindShift[] {
  const shifts: WindShift[] = [];
  let anchor: ScoredHour | null = null;
  for (const hour of hours) {
    if (hour.wind == null || hour.windSpeedKmh == null) continue;
    if (!anchor || anchor.wind == null || anchor.windSpeedKmh == null) {
      anchor = hour;
      continue;
    }
    const kindChanged = hour.wind.kind !== anchor.wind.kind;
    const speedChanged = Math.abs(hour.windSpeedKmh - anchor.windSpeedKmh) >= 12;
    if (kindChanged || speedChanged) {
      shifts.push({
        time: hour.time,
        from: anchor.wind.kind,
        to: hour.wind.kind,
        fromSpeed: anchor.windSpeedKmh,
        toSpeed: hour.windSpeedKmh,
      });
      anchor = hour;
    }
  }
  return shifts.slice(0, 6);
}

export function datesIn(hours: { time: string }[]): string[] {
  const dates: string[] = [];
  for (const hour of hours) {
    const date = hour.time.slice(0, 10);
    if (dates[dates.length - 1] !== date) dates.push(date);
  }
  return dates;
}
