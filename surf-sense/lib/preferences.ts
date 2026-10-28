import { z } from "zod";
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, type ScoreThresholds, type ScoreWeights } from "@/lib/config";
import { BEACHES } from "@/lib/beaches";

export type Skill = "beginner" | "intermediate" | "advanced";
export type SwellPreference = "any" | "nw" | "w" | "sw";
export type TidePreference = "any" | "low" | "mid" | "high" | "rising" | "falling";

export interface NotificationPrefs {
  enabled: boolean;
  /** Empty means the favourite beaches. */
  spotIds: string[];
  minScore: number;
  waveMinM: number;
  waveMaxM: number;
  maxWindKmh: number;
  leadHours: number;
  quietStartHour: number | null;
  quietEndHour: number | null;
  channels: {
    inApp: boolean;
    browser: boolean;
  };
}

export interface UserPreferences {
  skill: Skill;
  waveMinM: number;
  waveMaxM: number;
  minScore: number;
  maxWindKmh: number;
  swellPreference: SwellPreference;
  tidePreference: TidePreference;
  favoriteIds: string[];
  weights: ScoreWeights | null;
  thresholds: ScoreThresholds | null;
  notifications: NotificationPrefs;
}

export const SKILL_LABEL: Record<Skill, string> = {
  beginner: "Iniciante",
  intermediate: "Intermédio",
  advanced: "Avançado",
};

export const SWELL_PREFERENCE_LABEL: Record<SwellPreference, string> = {
  any: "Qualquer rumo que a praia aguente",
  nw: "Noroeste",
  w: "Oeste",
  sw: "Sudoeste",
};

export const TIDE_PREFERENCE_LABEL: Record<TidePreference, string> = {
  any: "Qualquer maré",
  low: "Baixa-mar",
  mid: "Meia-maré",
  high: "Preia-mar",
  rising: "A encher",
  falling: "A vazar",
};

export const SWELL_PREFERENCE_ARC: Record<Exclude<SwellPreference, "any">, { start: number; end: number }> = {
  nw: { start: 300, end: 340 },
  w: { start: 250, end: 290 },
  sw: { start: 210, end: 250 },
};

const knownIds = new Set(BEACHES.map((beach) => beach.id));

const finite = z.number().finite();

const weightsSchema = z.object({
  swellHeight: finite,
  swellDirection: finite,
  swellPeriod: finite,
  windDirection: finite,
  windSpeed: finite,
  tide: finite,
});

const thresholdsSchema = z.object({
  excellent: finite,
  good: finite,
  fair: finite,
});

const notificationSchema = z.object({
  enabled: z.boolean(),
  spotIds: z.array(z.string()),
  minScore: finite,
  waveMinM: finite,
  waveMaxM: finite,
  maxWindKmh: finite,
  leadHours: finite,
  quietStartHour: z.number().int().nullable(),
  quietEndHour: z.number().int().nullable(),
  channels: z.object({
    inApp: z.boolean(),
    browser: z.boolean(),
  }),
});

const preferencesSchema = z.object({
  skill: z.enum(["beginner", "intermediate", "advanced"]),
  waveMinM: finite,
  waveMaxM: finite,
  minScore: finite,
  maxWindKmh: finite,
  swellPreference: z.enum(["any", "nw", "w", "sw"]),
  tidePreference: z.enum(["any", "low", "mid", "high", "rising", "falling"]),
  favoriteIds: z.array(z.string()),
  weights: weightsSchema.nullable(),
  thresholds: thresholdsSchema.nullable(),
  notifications: notificationSchema,
});

export const DEFAULT_PREFERENCES: UserPreferences = {
  skill: "intermediate",
  waveMinM: 0.6,
  waveMaxM: 1.8,
  minScore: DEFAULT_THRESHOLDS.good,
  maxWindKmh: 30,
  swellPreference: "any",
  tidePreference: "any",
  favoriteIds: ["carcavelos", "caparica", "guincho"],
  weights: null,
  thresholds: null,
  notifications: {
    enabled: false,
    spotIds: [],
    minScore: DEFAULT_THRESHOLDS.good,
    waveMinM: 0.6,
    waveMaxM: 1.8,
    maxWindKmh: 30,
    leadHours: 36,
    quietStartHour: 22,
    quietEndHour: 8,
    channels: { inApp: true, browser: false },
  },
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeThresholds(value: ScoreThresholds | null): ScoreThresholds | null {
  if (!value) return null;
  let fair = clampNumber(value.fair, 1, 90);
  let good = clampNumber(value.good, fair + 1, 95);
  let excellent = clampNumber(value.excellent, good + 1, 100);
  if (!(excellent > good && good > fair)) {
    return null;
  }
  return { excellent, good, fair };
}

export function sanitizePreferences(input: unknown): UserPreferences {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return structuredClone(DEFAULT_PREFERENCES);
  const value = parsed.data;
  const waveMinM = clampNumber(Math.min(value.waveMinM, value.waveMaxM), 0.2, 4);
  const waveMaxM = clampNumber(Math.max(value.waveMinM, value.waveMaxM), waveMinM + 0.1, 5);
  const notifications = value.notifications;
  const alertMin = clampNumber(Math.min(notifications.waveMinM, notifications.waveMaxM), 0.2, 4);
  const alertMax = clampNumber(Math.max(notifications.waveMinM, notifications.waveMaxM), alertMin + 0.1, 5);
  return {
    skill: value.skill,
    waveMinM,
    waveMaxM,
    minScore: clampNumber(value.minScore, 0, 100),
    maxWindKmh: clampNumber(value.maxWindKmh, 5, 120),
    swellPreference: value.swellPreference,
    tidePreference: value.tidePreference,
    favoriteIds: value.favoriteIds.filter((id) => knownIds.has(id)),
    weights: value.weights,
    thresholds: sanitizeThresholds(value.thresholds),
    notifications: {
      enabled: notifications.enabled,
      spotIds: notifications.spotIds.filter((id) => knownIds.has(id)),
      minScore: clampNumber(notifications.minScore, 0, 100),
      waveMinM: alertMin,
      waveMaxM: alertMax,
      maxWindKmh: clampNumber(notifications.maxWindKmh, 5, 120),
      leadHours: clampNumber(notifications.leadHours, 1, 168),
      quietStartHour:
        notifications.quietStartHour == null ? null : clampNumber(notifications.quietStartHour, 0, 23),
      quietEndHour: notifications.quietEndHour == null ? null : clampNumber(notifications.quietEndHour, 0, 23),
      channels: {
        inApp: notifications.channels.inApp || !notifications.channels.browser,
        browser: notifications.channels.browser,
      },
    },
  };
}

export function activeWeights(preferences: UserPreferences): ScoreWeights {
  return preferences.weights ?? DEFAULT_WEIGHTS;
}

export function activeThresholds(preferences: UserPreferences): ScoreThresholds {
  return preferences.thresholds ?? DEFAULT_THRESHOLDS;
}
