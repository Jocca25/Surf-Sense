import { distanceToArc } from "@/lib/angles";
import type { Beach } from "@/lib/beaches";
import {
  DEFAULT_WEIGHTS,
  SAFETY_LIMITS,
  categoryForScore,
  clamp,
  normalizeWeights,
  type ScoreCategory,
  type ScoreThresholds,
  type ScoreWeights,
} from "@/lib/config";
import {
  SWELL_PREFERENCE_ARC,
  type Skill,
  type SwellPreference,
  type TidePreference,
  type UserPreferences,
} from "@/lib/preferences";
import { formatMeters, formatSeconds, zonedLocalToUtc } from "@/lib/time";
import { tideBand, type TideAtHour } from "@/lib/tides";
import { classifyWind, windDirectionScore, windKindLabel, type WindClassification, type WindKind } from "@/lib/wind";

export interface FactorResult {
  key: "swellHeight" | "swellDirection" | "swellPeriod" | "windDirection" | "windSpeed" | "tide";
  label: string;
  score: number | null;
  weight: number;
  available: boolean;
  detail: string;
}

export type SafetyLevel = "ok" | "caution" | "danger";
export type Confidence = "ok" | "partial" | "insufficient";

export interface ScoringHourInput {
  time: string;
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  windWaveHeightM: number | null;
  windWaveDirectionDeg: number | null;
  windWavePeriodS: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windGustKmh: number | null;
  seaTemperatureC: number | null;
  tide: TideAtHour | null;
}

export interface WarningInput {
  awarenessTypeName: string;
  awarenessLevelID: string;
  text: string;
  startTime: string;
  endTime: string;
}

export interface ScoredHour {
  time: string;
  /** Score after safety and suitability caps. Null when the hour cannot be judged. */
  score: number | null;
  /** Weighted surf quality before safety caps. */
  waveQuality: number | null;
  category: ScoreCategory | null;
  safety: SafetyLevel;
  safetyReasons: string[];
  confidence: Confidence;
  factors: FactorResult[];
  missing: string[];
  notes: string[];
  sizeM: number | null;
  sizeSource: "swell" | "wave" | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  windWaveHeightM: number | null;
  windSpeedKmh: number | null;
  windGustKmh: number | null;
  windDirectionDeg: number | null;
  wind: WindClassification | null;
  tide: TideAtHour | null;
  seaTemperatureC: number | null;
  cappedForSafety: boolean;
  suitabilityNote: string | null;
}

const SKILL_PLATEAU: Record<Skill, [number, number]> = {
  beginner: [0.4, 1.1],
  intermediate: [0.7, 1.9],
  advanced: [1.0, 2.8],
};

export function scoreHour(input: {
  beach: Beach;
  hour: ScoringHourInput;
  preferences: UserPreferences;
  warnings?: WarningInput[];
  marineUncertain?: boolean;
  weights?: ScoreWeights;
  thresholds?: ScoreThresholds;
}): ScoredHour {
  const { beach, hour, preferences } = input;
  const weights = normalizeWeights(input.weights ?? preferences.weights ?? DEFAULT_WEIGHTS);
  const thresholds = input.thresholds ?? preferences.thresholds ?? undefined;

  const sizeSource: ScoredHour["sizeSource"] =
    hour.swellHeightM != null ? "swell" : hour.waveHeightM != null ? "wave" : null;
  const sizeM = hour.swellHeightM ?? hour.waveHeightM;
  const direction = hour.swellDirectionDeg ?? hour.waveDirectionDeg;
  const period = hour.swellPeriodS ?? hour.wavePeriodS;
  const wind =
    hour.windDirectionDeg == null ? null : classifyWind(hour.windDirectionDeg, beach.facingDeg);

  const missing: string[] = [];
  if (sizeM == null) missing.push("altura da ondulação");
  if (direction == null) missing.push("direção da ondulação");
  if (period == null) missing.push("período");
  if (hour.windSpeedKmh == null || hour.windDirectionDeg == null) missing.push("vento");
  if (!hour.tide || hour.tide.confidence === "low") missing.push("maré");

  const notes: string[] = [];
  if (hour.swellHeightM == null && hour.waveHeightM != null) {
    notes.push("Não há uma altura de ondulação separada. Usei a altura significativa.");
  }
  if (hour.swellDirectionDeg == null && hour.waveDirectionDeg != null) {
    notes.push("A direção usada é a da onda combinada, não só da ondulação.");
  }

  const height = heightFactor(sizeM, hour.windWaveHeightM, beach, preferences);
  const directionFactor = directionFactorScore(direction, beach, preferences.swellPreference);
  const periodFactor = periodFactorScore(period, sizeM, beach, preferences.skill);
  const windDir = wind
    ? { score: windDirectionScore(wind.kind), detail: `Vento ${windKindLabel(wind.kind)}.`, note: null as string | null }
    : { score: null as number | null, detail: "Sem direção do vento.", note: null as string | null };
  const windSpeed =
    hour.windSpeedKmh == null || !wind
      ? { score: null as number | null, detail: "Sem velocidade do vento.", note: null as string | null }
      : windSpeedFactor(hour.windSpeedKmh, hour.windGustKmh, wind.kind, preferences.maxWindKmh);
  const tide = tideFactor(hour.tide, beach, preferences.tidePreference);

  if (height.note) notes.push(height.note);
  if (directionFactor.note) notes.push(directionFactor.note);
  if (periodFactor.note) notes.push(periodFactor.note);
  if (windSpeed.note) notes.push(windSpeed.note);
  if (tide.note) notes.push(tide.note);

  const factors: FactorResult[] = [
    factor("swellHeight", "Altura", height.score, weights.swellHeight, height.detail),
    factor("swellDirection", "Direção da ondulação", directionFactor.score, weights.swellDirection, directionFactor.detail),
    factor("swellPeriod", "Período", periodFactor.score, weights.swellPeriod, periodFactor.detail),
    factor("windDirection", "Direção do vento", windDir.score, weights.windDirection, windDir.detail),
    factor("windSpeed", "Força do vento", windSpeed.score, weights.windSpeed, windSpeed.detail),
    factor("tide", "Maré", tide.score, weights.tide, tide.detail),
  ];

  const usable = factors.filter((item) => item.available && item.score != null);
  const essentialMissing = sizeM == null || hour.windSpeedKmh == null || hour.windDirectionDeg == null;
  let waveQuality: number | null = null;
  if (!essentialMissing && usable.length > 0) {
    const weightSum = usable.reduce((sum, item) => sum + item.weight, 0);
    waveQuality = Math.round(
      usable.reduce((sum, item) => sum + (item.score as number) * item.weight, 0) / weightSum,
    );
  }

  const safety = assessSafety({
    beach,
    sizeM,
    period,
    windSpeed: hour.windSpeedKmh,
    gust: hour.windGustKmh,
    windKind: wind?.kind ?? null,
    skill: preferences.skill,
    warnings: input.warnings ?? [],
    time: hour.time,
    timeZone: beach.timezone,
  });

  let score = waveQuality;
  let cappedForSafety = false;
  if (score != null && safety.level === "caution") {
    const capped = Math.min(score, SAFETY_LIMITS.cautionMaxScore);
    cappedForSafety = capped < score;
    score = capped;
  }
  if (score != null && safety.level === "danger") {
    const capped = Math.min(score, SAFETY_LIMITS.dangerMaxScore);
    cappedForSafety = capped < score || cappedForSafety;
    score = capped;
  }

  let suitabilityNote: string | null = null;
  if (score != null && preferences.skill === "beginner" && beach.beginnerCap != null) {
    const cap = sizeM != null && sizeM >= 1.5 ? Math.min(beach.beginnerCap, 35) : beach.beginnerCap;
    if (score > cap) {
      score = cap;
      suitabilityNote = `${beach.name} não é uma praia para iniciantes. A pontuação fica limitada mesmo que a ondulação tenha boa forma.`;
    }
  } else if (score != null && preferences.skill !== "advanced" && beach.advancedOnly && score > 74) {
    score = 74;
    suitabilityNote = `${beach.name} é uma onda pesada. Mesmo com boa previsão, pede um nível avançado.`;
  }
  if (suitabilityNote) notes.push(suitabilityNote);

  const category = score == null ? null : categoryForScore(score, thresholds);

  let confidence: Confidence = "ok";
  if (essentialMissing || score == null) confidence = "insufficient";
  else if (
    direction == null ||
    period == null ||
    !hour.tide ||
    hour.tide.confidence === "low" ||
    input.marineUncertain
  ) {
    confidence = "partial";
  }
  if (input.marineUncertain) {
    notes.push("A leitura horária afasta-se do estado do mar diário do IPMA. Trata este número com reserva.");
  }

  const uniqueMissing = [...new Set(missing)];

  return {
    time: hour.time,
    score,
    waveQuality,
    category,
    safety: safety.level,
    safetyReasons: safety.reasons,
    confidence,
    factors,
    missing: uniqueMissing,
    notes,
    sizeM,
    sizeSource,
    swellHeightM: hour.swellHeightM,
    swellDirectionDeg: direction,
    swellPeriodS: period,
    waveHeightM: hour.waveHeightM,
    wavePeriodS: hour.wavePeriodS,
    windWaveHeightM: hour.windWaveHeightM,
    windSpeedKmh: hour.windSpeedKmh,
    windGustKmh: hour.windGustKmh,
    windDirectionDeg: hour.windDirectionDeg,
    wind,
    tide: hour.tide,
    seaTemperatureC: hour.seaTemperatureC,
    cappedForSafety,
    suitabilityNote,
  };
}

function factor(
  key: FactorResult["key"],
  label: string,
  score: number | null,
  weight: number,
  detail: string,
): FactorResult {
  return {
    key,
    label,
    score: score == null ? null : Math.round(score),
    weight,
    available: score != null,
    detail,
  };
}

function heightFactor(
  sizeM: number | null,
  windWaveM: number | null,
  beach: Beach,
  preferences: UserPreferences,
): { score: number | null; detail: string; note: string | null } {
  if (sizeM == null) {
    return { score: null, detail: "Sem altura de onda.", note: null };
  }
  const skill = preferences.skill;
  const [skillMin, skillMax] = SKILL_PLATEAU[skill];
  let plateauMin = Math.max(skillMin, preferences.waveMinM, beach.idealSwellHeight.min);
  let plateauMax = Math.min(skillMax, preferences.waveMaxM, beach.idealSwellHeight.max);
  let mismatch = false;
  if (plateauMin > plateauMax) {
    mismatch = true;
    plateauMin = Math.max(skillMin, beach.minSwellHeight);
    plateauMax = Math.min(skillMax, beach.heavySwellHeight);
    if (plateauMin > plateauMax) {
      plateauMin = skillMin;
      plateauMax = skillMax;
    }
  }
  const zeroMin = Math.max(0, plateauMin - 0.6);
  const zeroMax = plateauMax + (skill === "beginner" ? 0.5 : skill === "intermediate" ? 1 : 1.6);
  let score = trapezoid(sizeM, plateauMin, plateauMax, zeroMin, zeroMax);
  let note: string | null = null;
  if (skill === "beginner" && sizeM >= 1.6) {
    score = Math.min(score, 20);
    note = "Para um iniciante, esta altura já é pesada.";
  } else if (mismatch) {
    note = "O tamanho que pediste não encaixa no teu nível ou no que esta praia costuma oferecer.";
  }
  if (windWaveM != null && sizeM > 0.3 && windWaveM / Math.max(sizeM, 0.1) > 0.6) {
    score = Math.round(score * 0.75);
    note = note
      ? `${note} Há também muita vaga de vento, por isso o mar fica mais desorganizado.`
      : "Há muita vaga de vento em relação à ondulação, por isso o mar fica mais desorganizado.";
  }
  const detail = `Cerca de ${formatMeters(sizeM)} m. A faixa mais adequada aqui, para este nível, vai de ${formatMeters(plateauMin)} a ${formatMeters(plateauMax)} m.`;
  return { score, detail, note };
}

function directionFactorScore(
  direction: number | null,
  beach: Beach,
  preference: SwellPreference,
): { score: number | null; detail: string; note: string | null } {
  if (direction == null) return { score: null, detail: "Sem direção da ondulação.", note: null };
  const idealDistance = distanceToArc(direction, beach.idealSwell.start, beach.idealSwell.end);
  const windowDistance = distanceToArc(direction, beach.swellWindow.start, beach.swellWindow.end);
  let score = windowDistance === 0 ? clamp(100 - idealDistance * 1.6) : clamp(55 - windowDistance * 1.5);
  let note: string | null = null;
  if (preference !== "any") {
    const arc = SWELL_PREFERENCE_ARC[preference];
    const userDistance = distanceToArc(direction, arc.start, arc.end);
    const userScore = userDistance === 0 ? 100 : clamp(100 - userDistance * 2);
    const blended = score * 0.75 + userScore * 0.25;
    score = score < 40 ? Math.min(blended, score + 5) : blended;
    if (windowDistance > 25 && userDistance === 0) {
      note = "O rumo que preferes quase não entra nesta praia. A pontuação segue a orientação da costa, não só o teu gosto.";
    }
  }
  const detail =
    windowDistance === 0
      ? "A ondulação entra na janela desta praia."
      : `A ondulação fica cerca de ${Math.round(windowDistance)}° fora do que esta praia recebe bem.`;
  return { score, detail, note };
}

function periodFactorScore(
  period: number | null,
  sizeM: number | null,
  beach: Beach,
  skill: Skill,
): { score: number | null; detail: string; note: string | null } {
  if (period == null) return { score: null, detail: "Sem período.", note: null };
  const { min, max } = beach.idealPeriod;
  let score = period >= min && period <= max ? 100 : period < min ? clamp(100 - (min - period) * 18) : clamp(100 - (period - max) * 8);
  let note: string | null = null;
  if (period < 7) {
    score = Math.min(score, 45);
    note = "O período é curto, típico de mar de vento, com ondas menos organizadas.";
  }
  if (skill === "beginner" && period >= 13 && (sizeM ?? 0) >= 1.2) {
    score = Math.min(score, 40);
    note = "Período longo com este tamanho significa mais força. Para um iniciante fica exigente.";
  }
  return {
    score,
    detail: `Período de ${formatSeconds(period)} s. Nesta praia, o intervalo mais limpo costuma ser ${min}–${max} s.`,
    note,
  };
}

export function windSpeedFactor(
  speedKmh: number,
  gustKmh: number | null,
  kind: WindKind,
  maxWindKmh: number,
): { score: number; detail: string; note: string | null } {
  const gust = gustKmh ?? speedKmh;
  const effective = Math.max(speedKmh, gust * 0.85);
  const offshoreish = kind === "offshore" || kind === "cross-offshore";
  let score: number;
  if (offshoreish) {
    if (effective <= 15) score = 100;
    else if (effective <= 28) score = 100 - (effective - 15) * 1.2;
    else if (effective <= 40) score = 84 - (effective - 28) * 3;
    else if (effective <= 55) score = 48 - (effective - 40) * 2.2;
    else score = Math.max(0, 15 - (effective - 55));
  } else if (kind === "cross-shore") {
    if (effective <= 12) score = 78;
    else if (effective <= 25) score = 78 - (effective - 12) * 2;
    else score = Math.max(0, 52 - (effective - 25) * 2.2);
  } else if (effective <= 10) score = 62;
  else if (effective <= 20) score = 62 - (effective - 10) * 2.4;
  else score = Math.max(0, 38 - (effective - 20) * 1.8);

  if (gust - speedKmh >= 18) score -= 8;
  let note: string | null = null;
  if (speedKmh > maxWindKmh) {
    score = Math.min(score, 28);
    note = `O vento passa o teu limite de ${Math.round(maxWindKmh)} km/h.`;
  }
  if (offshoreish && effective >= 40) {
    note = note
      ? `${note} Vento de terra forte também pode segurar a onda e tornar a saída difícil.`
      : "Vento de terra forte não limpa a onda de forma automática: pode segurá-la e dificultar a saída.";
  }
  return {
    score: clamp(score),
    detail: `${Math.round(speedKmh)} km/h, rajadas ${Math.round(gust)} km/h.`,
    note,
  };
}

function tideFactor(
  tide: TideAtHour | null,
  beach: Beach,
  preference: TidePreference,
): { score: number | null; detail: string; note: string | null } {
  if (!tide) {
    return { score: null, detail: "Sem maré utilizável.", note: null };
  }
  if (tide.confidence === "low") {
    return {
      score: null,
      detail: "O sinal de maré é fraco ou incompleto, por isso não entra na pontuação.",
      note: "A maré não entrou na pontuação porque o sinal não é fiável.",
    };
  }
  const { min, max } = beach.preferredTide;
  const distance = tide.position < min ? min - tide.position : tide.position > max ? tide.position - max : 0;
  let score = clamp(100 - distance * 180);
  if (beach.preferredTidePhase !== "any" && (tide.phase === "rising" || tide.phase === "falling")) {
    score = tide.phase === beach.preferredTidePhase ? Math.min(100, score + 4) : Math.max(0, score - 12);
  }
  let note: string | null = null;
  if (preference !== "any") {
    const userScore = userTideScore(tide, preference);
    score = score * 0.7 + userScore * 0.3;
    if (userScore < 50) note = "A maré não está na fase que preferes.";
  }
  return {
    score,
    detail: `Maré ${tide.label}. Esta praia costuma trabalhar melhor entre ${Math.round(min * 100)}% e ${Math.round(max * 100)}% da enchente.`,
    note,
  };
}

function userTideScore(tide: TideAtHour, preference: TidePreference): number {
  if (preference === "rising") return tide.phase === "rising" ? 100 : 35;
  if (preference === "falling") return tide.phase === "falling" ? 100 : 35;
  const band = tideBand(tide.position);
  if (preference === band) return 100;
  if (preference === "mid" && (band === "low" || band === "high")) return 45;
  return 30;
}

function trapezoid(value: number, plateauMin: number, plateauMax: number, zeroMin: number, zeroMax: number): number {
  if (plateauMin > plateauMax) return 0;
  if (value >= plateauMin && value <= plateauMax) return 100;
  if (value < plateauMin) {
    if (value <= zeroMin || plateauMin === zeroMin) return 0;
    return ((value - zeroMin) / (plateauMin - zeroMin)) * 100;
  }
  if (value >= zeroMax || zeroMax === plateauMax) return 0;
  return ((zeroMax - value) / (zeroMax - plateauMax)) * 100;
}

function assessSafety(input: {
  beach: Beach;
  sizeM: number | null;
  period: number | null;
  windSpeed: number | null;
  gust: number | null;
  windKind: WindKind | null;
  skill: Skill;
  warnings: WarningInput[];
  time: string;
  timeZone: string;
}): { level: SafetyLevel; reasons: string[] } {
  const reasons: string[] = [];
  let level: SafetyLevel = "ok";
  const raise = (next: SafetyLevel, reason: string) => {
    reasons.push(reason);
    if (next === "danger" || level !== "danger") level = next;
  };

  if (input.windSpeed != null && input.windSpeed >= SAFETY_LIMITS.dangerWindKmh) {
    raise("danger", `Vento previsto de ${Math.round(input.windSpeed)} km/h.`);
  } else if (input.windSpeed != null && input.windSpeed >= SAFETY_LIMITS.cautionWindKmh) {
    raise("caution", `Vento moderado a forte, ${Math.round(input.windSpeed)} km/h.`);
  }
  if (input.gust != null && input.gust >= SAFETY_LIMITS.dangerGustKmh) {
    raise("danger", `Rajadas previstas de ${Math.round(input.gust)} km/h.`);
  } else if (input.gust != null && input.gust >= SAFETY_LIMITS.cautionGustKmh) {
    raise("caution", `Rajadas de ${Math.round(input.gust)} km/h.`);
  }
  if (input.sizeM != null && input.sizeM >= input.beach.heavySwellHeight) {
    raise(
      input.skill === "advanced" ? "caution" : "danger",
      `Altura de ${formatMeters(input.sizeM)} m, acima do que esta praia costuma oferecer com segurança.`,
    );
  }
  if (input.skill === "beginner" && input.sizeM != null && input.sizeM >= 1.8) {
    raise("danger", "Altura elevada para um iniciante.");
  }
  if (input.skill === "beginner" && input.sizeM != null && (input.period ?? 0) >= 14 && input.sizeM >= 1.3) {
    raise("caution", "Período longo com tamanho já relevante para quem está a começar.");
  }
  if (input.windKind === "onshore" && (input.windSpeed ?? 0) >= 40) {
    raise("danger", "Vento de mar forte, com mar desorganizado.");
  }

  for (const warning of input.warnings) {
    if (!warningIsActive(warning, input.time, input.timeZone)) continue;
    const colour = warning.awarenessLevelID.toLowerCase();
    const marine = /agita|vento|trovoada/i.test(warning.awarenessTypeName);
    if ((colour === "red" || colour === "orange") && marine) {
      raise("danger", `Aviso ${colour === "red" ? "vermelho" : "laranja"} do IPMA: ${warning.awarenessTypeName}.`);
    } else if (colour === "yellow" && marine) {
      raise("caution", `Aviso amarelo do IPMA: ${warning.awarenessTypeName}.`);
    } else if (colour === "orange" || colour === "red") {
      raise("caution", `Aviso do IPMA (${warning.awarenessTypeName}).`);
    }
  }

  return { level, reasons: [...new Set(reasons)] };
}

export function warningIsActive(warning: WarningInput, localTime: string, timeZone: string): boolean {
  const start = Date.parse(asUtc(warning.startTime));
  const end = Date.parse(asUtc(warning.endTime));
  const hour = zonedLocalToUtc(localTime.slice(0, 16), timeZone).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(hour)) return false;
  return hour >= start && hour < end;
}

function asUtc(value: string): string {
  if (value.endsWith("Z") || /[+-]\d\d:\d\d$/.test(value)) return value;
  return `${value}Z`;
}
