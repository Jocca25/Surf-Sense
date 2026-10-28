/** Compass maths. Degrees follow the meteorological convention: 0 is north, clockwise. */

export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) {
    throw new Error("Ângulo inválido");
  }
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Smallest signed turn from `fromDeg` to `toDeg`, in the range (-180, 180].
 * Positive means clockwise.
 */
export function signedAngleDiff(fromDeg: number, toDeg: number): number {
  const raw = normalizeDegrees(toDeg) - normalizeDegrees(fromDeg);
  if (raw > 180) return raw - 360;
  if (raw <= -180) return raw + 360;
  return raw;
}

/** Smallest absolute separation between two directions, from 0 to 180. */
export function angularDistance(a: number, b: number): number {
  return Math.abs(signedAngleDiff(a, b));
}

/**
 * True when `degrees` sits on the arc that runs clockwise from `start` to `end`,
 * including both ends. The arc may cross 0°.
 */
export function inArc(degrees: number, start: number, end: number): boolean {
  const value = normalizeDegrees(degrees);
  const from = normalizeDegrees(start);
  const to = normalizeDegrees(end);
  if (from <= to) return value >= from && value <= to;
  return value >= from || value <= to;
}

/** How far `degrees` sits outside the arc. Zero when it is inside. */
export function distanceToArc(degrees: number, start: number, end: number): number {
  if (inArc(degrees, start, end)) return 0;
  return Math.min(angularDistance(degrees, start), angularDistance(degrees, end));
}

const COMPASS_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

const COMPASS_PT: Record<(typeof COMPASS_16)[number], string> = {
  N: "norte",
  NNE: "nor-nordeste",
  NE: "nordeste",
  ENE: "lés-nordeste",
  E: "este",
  ESE: "lés-sudeste",
  SE: "sudeste",
  SSE: "sul-sudeste",
  S: "sul",
  SSW: "sul-sudoeste",
  SW: "sudoeste",
  WSW: "oés-sudoeste",
  W: "oeste",
  WNW: "oés-noroeste",
  NW: "noroeste",
  NNW: "nor-noroeste",
};

export function compass16(degrees: number): (typeof COMPASS_16)[number] {
  const index = Math.round(normalizeDegrees(degrees) / 22.5) % 16;
  return COMPASS_16[index];
}

export function compassName(degrees: number): string {
  return COMPASS_PT[compass16(degrees)];
}

/** "noroeste (300°)" */
export function compassPhrase(degrees: number): string {
  return `${compassName(degrees)} (${Math.round(normalizeDegrees(degrees))}°)`;
}
