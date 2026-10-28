export interface TideExtreme {
  time: string;
  levelM: number;
  kind: "high" | "low";
  /** True when the time is snapped to the hourly model, not a published tide table. */
  approximate: boolean;
}

export type TidePhase = "rising" | "falling" | "high" | "low";

export interface TideAtHour {
  levelM: number;
  /** 0 at the surrounding low water, 1 at the surrounding high water. */
  position: number;
  phase: TidePhase;
  label: string;
  confidence: "ok" | "low";
  previousExtreme: TideExtreme | null;
  nextExtreme: TideExtreme | null;
}

interface LevelSample {
  time: string;
  levelM: number;
}

const MIN_TURN = 0.05;

export function findExtremes(samples: LevelSample[], approximate: boolean): TideExtreme[] {
  const extremes: TideExtreme[] = [];
  for (let index = 1; index < samples.length - 1; index += 1) {
    const previous = samples[index - 1].levelM;
    const current = samples[index].levelM;
    const next = samples[index + 1].levelM;
    if (current > previous && current >= next && current - Math.min(previous, next) >= MIN_TURN) {
      extremes.push({ time: samples[index].time, levelM: current, kind: "high", approximate });
    } else if (current < previous && current <= next && Math.max(previous, next) - current >= MIN_TURN) {
      extremes.push({ time: samples[index].time, levelM: current, kind: "low", approximate });
    }
  }
  return dropPlateaus(extremes);
}

function dropPlateaus(extremes: TideExtreme[]): TideExtreme[] {
  return extremes.filter((extreme, index) => extremes[index - 1]?.kind !== extreme.kind);
}

export function tideLabel(position: number, phase: TidePhase): string {
  if (phase === "high" || (position >= 0.85 && phase !== "rising")) return "preia-mar";
  if (phase === "low" || (position <= 0.15 && phase !== "falling")) return "baixa-mar";
  if (phase === "rising" && position < 0.45) return "a encher";
  if (phase === "rising") return "meia-maré, a encher";
  if (phase === "falling" && position > 0.55) return "a vazar";
  return "meia-maré, a vazar";
}

export function annotateTideLevels(
  hours: { time: string; tideLevelM: number | null }[],
  providedExtremes?: TideExtreme[] | null,
): { byTime: Map<string, TideAtHour | null>; extremes: TideExtreme[] } {
  const known = hours.flatMap((hour) =>
    hour.tideLevelM == null ? [] : [{ time: hour.time, levelM: hour.tideLevelM }],
  );
  const derived = findExtremes(known, true);
  const extremes = providedExtremes && providedExtremes.length >= 2 ? providedExtremes : derived;
  const byTime = new Map<string, TideAtHour | null>();

  hours.forEach((hour, index) => {
    if (hour.tideLevelM == null) {
      byTime.set(hour.time, null);
      return;
    }
    const previousLevel = hours[index - 1]?.tideLevelM;
    const nextLevel = hours[index + 1]?.tideLevelM;
    const previousExtreme = lastAtOrBefore(extremes, hour.time);
    const nextExtreme = firstAfter(extremes, hour.time);
    const ownExtreme = extremes.find((extreme) => extreme.time === hour.time) ?? null;

    let phase: TidePhase = "rising";
    if (ownExtreme?.kind === "high") phase = "high";
    else if (ownExtreme?.kind === "low") phase = "low";
    else if (nextExtreme?.kind === "high") phase = "rising";
    else if (nextExtreme?.kind === "low") phase = "falling";
    else if (previousLevel != null && hour.tideLevelM < previousLevel) phase = "falling";
    else if (nextLevel != null && nextLevel < hour.tideLevelM) phase = "falling";

    const pair = bracketPair(previousExtreme, nextExtreme, ownExtreme);
    let position = 0.5;
    let confidence: "ok" | "low" = "ok";
    if (pair) {
      const range = pair.high - pair.low;
      if (range < 0.2) confidence = "low";
      position = range <= 0.05 ? 0.5 : clamp01((hour.tideLevelM - pair.low) / range);
      if (phase === "high") position = 1;
      if (phase === "low") position = 0;
    } else {
      confidence = "low";
    }

    byTime.set(hour.time, {
      levelM: hour.tideLevelM,
      position,
      phase,
      label: tideLabel(position, phase),
      confidence,
      previousExtreme,
      nextExtreme,
    });
  });

  return { byTime, extremes };
}

function bracketPair(
  previous: TideExtreme | null,
  next: TideExtreme | null,
  own: TideExtreme | null,
): { low: number; high: number } | null {
  const around = [previous, own, next].filter((item): item is TideExtreme => item != null);
  const high = around.filter((item) => item.kind === "high").map((item) => item.levelM);
  const low = around.filter((item) => item.kind === "low").map((item) => item.levelM);
  if (high.length === 0 || low.length === 0) return null;
  return { high: Math.max(...high), low: Math.min(...low) };
}

function lastAtOrBefore(extremes: TideExtreme[], time: string): TideExtreme | null {
  let found: TideExtreme | null = null;
  for (const extreme of extremes) {
    if (extreme.time <= time) found = extreme;
    else break;
  }
  return found;
}

function firstAfter(extremes: TideExtreme[], time: string): TideExtreme | null {
  return extremes.find((extreme) => extreme.time > time) ?? null;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function tideBand(position: number): "low" | "mid" | "high" {
  if (position < 0.33) return "low";
  if (position > 0.67) return "high";
  return "mid";
}
