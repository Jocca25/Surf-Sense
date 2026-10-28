import { signedAngleDiff } from "@/lib/angles";

export type WindKind =
  | "offshore"
  | "cross-offshore"
  | "cross-shore"
  | "cross-onshore"
  | "onshore";

export interface WindClassification {
  kind: WindKind;
  /** 0 means the wind comes straight off the sea. 180 means it comes straight off the land. */
  degreesFromOnshore: number;
  /**
   * Signed angle from the onshore axis, in (-180, 180].
   * Positive means the wind source is to the right when you look out to sea.
   */
  signedFromOnshore: number;
  /** 0 onshore, 1 offshore. */
  offshoreAlignment: number;
}

/**
 * Classify wind for one beach.
 *
 * `facingDeg` is the compass direction you look when you face the sea.
 * `windFromDeg` is the meteorological wind direction: where the wind comes FROM.
 * Onshore wind therefore comes from roughly the same direction as `facingDeg`.
 * Offshore wind comes from the opposite direction.
 */
export function classifyWind(windFromDeg: number, facingDeg: number): WindClassification {
  const signedFromOnshore = signedAngleDiff(facingDeg, windFromDeg);
  const degreesFromOnshore = Math.abs(signedFromOnshore);
  const kind = kindFromSeparation(degreesFromOnshore);
  return {
    kind,
    degreesFromOnshore,
    signedFromOnshore,
    offshoreAlignment: degreesFromOnshore / 180,
  };
}

export function kindFromSeparation(degreesFromOnshore: number): WindKind {
  const abs = Math.abs(degreesFromOnshore);
  if (abs <= 30) return "onshore";
  if (abs <= 70) return "cross-onshore";
  if (abs <= 110) return "cross-shore";
  if (abs <= 150) return "cross-offshore";
  return "offshore";
}

export function windKindLabel(kind: WindKind): string {
  switch (kind) {
    case "offshore":
      return "de terra";
    case "cross-offshore":
      return "cruzado de terra";
    case "cross-shore":
      return "cruzado";
    case "cross-onshore":
      return "cruzado de mar";
    case "onshore":
      return "de mar";
  }
}

export function windKindShort(kind: WindKind): string {
  switch (kind) {
    case "offshore":
      return "De terra";
    case "cross-offshore":
      return "Cruzado de terra";
    case "cross-shore":
      return "Cruzado";
    case "cross-onshore":
      return "Cruzado de mar";
    case "onshore":
      return "De mar";
  }
}

const WIND_DIRECTION_SCORE: Record<WindKind, number> = {
  offshore: 100,
  "cross-offshore": 84,
  "cross-shore": 64,
  "cross-onshore": 42,
  onshore: 24,
};

export function windDirectionScore(kind: WindKind): number {
  return WIND_DIRECTION_SCORE[kind];
}
