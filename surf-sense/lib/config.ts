export interface ScoreWeights {
  swellHeight: number;
  swellDirection: number;
  swellPeriod: number;
  windDirection: number;
  windSpeed: number;
  tide: number;
}

export interface ScoreThresholds {
  excellent: number;
  good: number;
  fair: number;
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  swellHeight: 0.22,
  swellDirection: 0.18,
  swellPeriod: 0.14,
  windDirection: 0.18,
  windSpeed: 0.16,
  tide: 0.12,
};

/** Initial bands. Excellent starts at 85, good at 65, fair at 40. */
export const DEFAULT_THRESHOLDS: ScoreThresholds = {
  excellent: 85,
  good: 65,
  fair: 40,
};

export const SAFETY_LIMITS = {
  dangerWindKmh: 50,
  dangerGustKmh: 70,
  cautionWindKmh: 35,
  cautionGustKmh: 55,
  /** A dangerous hour cannot be presented above this score. */
  dangerMaxScore: 39,
  /** A caution hour cannot be labelled excellent. */
  cautionMaxScore: 84,
};

export type ScoreCategory = "excellent" | "good" | "fair" | "poor";

export function categoryForScore(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): ScoreCategory {
  if (score >= thresholds.excellent) return "excellent";
  if (score >= thresholds.good) return "good";
  if (score >= thresholds.fair) return "fair";
  return "poor";
}

export const CATEGORY_LABEL: Record<ScoreCategory, string> = {
  excellent: "Excelente",
  good: "Bom",
  fair: "Razoável",
  poor: "Fraco",
};

export function clamp(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function normalizeWeights(weights: ScoreWeights): ScoreWeights {
  const keys = Object.keys(weights) as (keyof ScoreWeights)[];
  const safe = { ...DEFAULT_WEIGHTS };
  let sum = 0;
  for (const key of keys) {
    const value = Number(weights[key]);
    safe[key] = Number.isFinite(value) && value > 0 ? value : 0;
    sum += safe[key];
  }
  if (sum <= 0) return { ...DEFAULT_WEIGHTS };
  for (const key of keys) safe[key] = safe[key] / sum;
  return safe;
}
