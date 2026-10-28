export const LISBON_TIMEZONE = "Europe/Lisbon";

function partsInZone(instant: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    map[part.type] = part.value;
  }
  if (map.hour === "24") map.hour = "00";
  return map;
}

/** Minutes to add to UTC to get the civil time in `timeZone`. Lisbon in summer is +60. */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const map = partsInZone(instant, timeZone);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * Convert a civil timestamp without a zone suffix, such as "2026-07-15T12:00",
 * into a UTC Date. The timestamp is read in `timeZone`.
 */
export function zonedLocalToUtc(localIso: string, timeZone: string): Date {
  const normalized = localIso.length === 16 ? `${localIso}:00` : localIso;
  const [datePart, timePart] = normalized.split("T");
  if (!datePart || !timePart) {
    throw new Error(`Hora local inválida: ${localIso}`);
  }
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second = 0] = timePart.split(":").map(Number);
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const firstOffset = timeZoneOffsetMinutes(guess, timeZone);
  const adjusted = new Date(guess.getTime() - firstOffset * 60000);
  const secondOffset = timeZoneOffsetMinutes(adjusted, timeZone);
  return new Date(guess.getTime() - secondOffset * 60000);
}

/** "2026-10-28T14:05" in the given zone. */
export function utcToZonedLocalIso(instant: Date, timeZone: string): string {
  const map = partsInZone(instant, timeZone);
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export function zonedHour(instant: Date, timeZone: string): number {
  return Number(utcToZonedLocalIso(instant, timeZone).slice(11, 13));
}

export function addLocalHours(localIso: string, hours: number, timeZone: string): string {
  const utc = zonedLocalToUtc(localIso, timeZone);
  return utcToZonedLocalIso(new Date(utc.getTime() + hours * 60 * 60 * 1000), timeZone);
}

export function formatHourLabel(localIso: string): string {
  return localIso.slice(11, 16);
}

export function formatLongDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(instant);
}

export function formatDayLabel(date: string, now: Date, timeZone: string): string {
  const today = utcToZonedLocalIso(now, timeZone).slice(0, 10);
  const tomorrow = utcToZonedLocalIso(new Date(now.getTime() + 24 * 60 * 60 * 1000), timeZone).slice(0, 10);
  if (date === today) return "Hoje";
  if (date === tomorrow) return "Amanhã";
  const noon = zonedLocalToUtc(`${date}T12:00`, timeZone);
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(noon);
}

export function formatClock(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 19) return "Boa tarde";
  return "Boa noite";
}

export function formatMeters(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatSeconds(value: number): string {
  const digits = Math.abs(value - Math.round(value)) < 0.05 ? 0 : 1;
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function isQuietHour(hour: number, start: number | null, end: number | null): boolean {
  if (start == null || end == null || start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}
