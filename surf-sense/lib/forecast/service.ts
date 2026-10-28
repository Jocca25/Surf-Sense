import { BEACHES, getBeach, type Beach } from "@/lib/beaches";
import { fetchIpma, type IpmaBundle } from "@/lib/forecast/ipma";
import { fetchOpenMeteo } from "@/lib/forecast/open-meteo";
import { TIDE_COPY, type ForecastBundle, type RawHour, type SpotForecast, type TideMeta } from "@/lib/forecast/types";
import { fetchWorldTides, worldTidesConfigured } from "@/lib/forecast/worldtides";
import { formatMeters, utcToZonedLocalIso } from "@/lib/time";
import { annotateTideLevels, type TideExtreme } from "@/lib/tides";

interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

const freshMs = () => {
  const parsed = Number(process.env.FORECAST_CACHE_TTL_SECONDS ?? 1800);
  const seconds = Number.isFinite(parsed) ? parsed : 1800;
  return Math.min(6 * 60 * 60, Math.max(60, seconds)) * 1000;
};
const MAX_STALE_MS = 6 * 60 * 60 * 1000;

const memory = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

async function remember<T>(key: string, loader: () => Promise<T>, refresh: boolean): Promise<{ value: T; stale: boolean }> {
  const cached = memory.get(key) as CacheEntry<T> | undefined;
  const age = cached ? Date.now() - cached.savedAt : Infinity;
  if (!refresh && cached && age < freshMs()) {
    return { value: cached.value, stale: false };
  }
  if (!refresh && pending.has(key)) {
    const value = (await pending.get(key)) as T;
    return { value, stale: false };
  }
  const promise = loader()
    .then((value) => {
      memory.set(key, { savedAt: Date.now(), value });
      pending.delete(key);
      return value;
    })
    .catch((error: unknown) => {
      pending.delete(key);
      throw error;
    });
  pending.set(key, promise);
  try {
    const value = await promise;
    return { value, stale: false };
  } catch (error) {
    if (cached && age < MAX_STALE_MS) return { value: cached.value, stale: true };
    throw error;
  }
}

export async function getForecastBundle(ids?: string[], refresh = false): Promise<ForecastBundle> {
  const beaches = (ids && ids.length > 0 ? ids : BEACHES.map((beach) => beach.id))
    .map((id) => getBeach(id))
    .filter((beach): beach is Beach => beach != null);
  const unique = [...new Map(beaches.map((beach) => [beach.id, beach])).values()];

  let ipma: IpmaBundle = { warnings: [], daily: [], error: "IPMA não consultado." };
  let ipmaStale = false;
  try {
    const result = await remember("ipma", () => fetchIpma(1111026), refresh);
    ipma = result.value;
    ipmaStale = result.stale;
  } catch {
    ipma = { warnings: [], daily: [], error: "Os avisos e o estado do mar do IPMA não estão disponíveis nesta consulta." };
  }

  const spots = await Promise.all(unique.map((beach) => buildSpot(beach, ipma, refresh)));
  const anyLive = spots.some((spot) => spot.marineOk && !spot.stale);
  return {
    fetchedAt: new Date().toISOString(),
    stale: !anyLive || ipmaStale || spots.every((spot) => spot.stale),
    spots,
    message: spots.every((spot) => !spot.marineOk && !spot.windOk)
      ? "Não consegui obter a previsão do mar nem do vento. Não vou inventar números."
      : null,
  };
}

async function buildSpot(beach: Beach, ipma: IpmaBundle, refresh: boolean): Promise<SpotForecast> {
  const fetchedAt = new Date().toISOString();
  try {
    const meteo = await remember(`meteo:${beach.id}`, () => fetchOpenMeteo(beach.latitude, beach.longitude), refresh);
    const tide = await resolveTide(beach, meteo.value.hours, refresh);
    const hours: RawHour[] = meteo.value.hours.map((hour) => ({
      ...hour,
      tideLevelM: tide.levels.get(hour.time) ?? null,
    }));
    const warnings = ipma.warnings.filter((warning) => warning.idAreaAviso === beach.ipmaWarningArea);
    const uncertainty = marineUncertainty(hours, ipma.daily);
    const errors = [meteo.value.marineError, meteo.value.windError, ipma.error].filter(Boolean);
    return {
      spotId: beach.id,
      timezone: beach.timezone,
      fetchedAt,
      stale: meteo.stale || tide.stale,
      marineOk: meteo.value.marineOk,
      windOk: meteo.value.windOk,
      error: errors.length ? errors.join(" ") : null,
      tide: tide.meta,
      ipmaDaily: ipma.daily,
      marineUncertain: uncertainty.uncertain,
      uncertaintyNote: uncertainty.note,
      warnings,
      hours,
    };
  } catch (error) {
    return emptySpot(
      beach,
      fetchedAt,
      error instanceof Error ? error.message : "Não foi possível obter a previsão desta praia.",
    );
  }
}

async function resolveTide(
  beach: Beach,
  hours: { time: string; seaLevelM: number | null }[],
  refresh: boolean,
): Promise<{ meta: TideMeta; levels: Map<string, number | null>; stale: boolean }> {
  if (worldTidesConfigured()) {
    try {
      const result = await remember(
        `tides:${beach.id}`,
        () => fetchWorldTides(beach.latitude, beach.longitude),
        refresh,
      );
      const levels = new Map<string, number | null>();
      for (const hour of hours) {
        const nearest = nearestLevel(hour.time, result.value.levels);
        levels.set(hour.time, nearest);
      }
      return {
        stale: result.stale,
        levels,
        meta: {
          provider: "worldtides",
          ...TIDE_COPY.worldtides,
          approximateExtremes: false,
          extremes: result.value.extremes,
        },
      };
    } catch {
      // Fall through to the model sea level and say so in the limitation.
    }
  }

  const samples = hours.map((hour) => ({ time: hour.time, tideLevelM: hour.seaLevelM }));
  const annotated = annotateTideLevels(samples);
  const hasSignal = samples.some((hour) => hour.tideLevelM != null);
  return {
    stale: false,
    levels: new Map(samples.map((hour) => [hour.time, hour.tideLevelM])),
    meta: hasSignal
      ? {
          provider: "open-meteo-sea-level",
          ...TIDE_COPY.openMeteo,
          approximateExtremes: true,
          extremes: annotated.extremes,
        }
      : {
          provider: "unavailable",
          ...TIDE_COPY.unavailable,
          approximateExtremes: true,
          extremes: [] as TideExtreme[],
        },
  };
}

function nearestLevel(localTime: string, levels: { time: string; levelM: number }[]): number | null {
  const target = Date.parse(`${localTime}:00Z`);
  let best: { levelM: number; gap: number } | null = null;
  for (const level of levels) {
    const gap = Math.abs(Date.parse(`${level.time}:00Z`) - target);
    if (!best || gap < best.gap) best = { levelM: level.levelM, gap };
  }
  if (!best || best.gap > 40 * 60 * 1000) return null;
  return best.levelM;
}

function marineUncertainty(
  hours: RawHour[],
  daily: SpotForecast["ipmaDaily"],
): { uncertain: boolean; note: string | null } {
  const today = utcToZonedLocalIso(new Date(), "Europe/Lisbon").slice(0, 10);
  const official = daily.find((item) => item.forecastDate === today);
  if (!official || official.totalSeaMin == null || official.totalSeaMax == null) {
    return { uncertain: false, note: null };
  }
  const waves = hours
    .filter((hour) => hour.time.startsWith(today))
    .map((hour) => hour.waveHeightM)
    .filter((value): value is number => value != null);
  if (waves.length === 0) return { uncertain: false, note: null };
  const maxWave = Math.max(...waves);
  const mid = (official.totalSeaMin + official.totalSeaMax) / 2;
  if (Math.abs(maxWave - mid) <= 1.5) return { uncertain: false, note: null };
  return {
    uncertain: true,
    note: `A altura máxima de hoje no modelo horário é ${formatMeters(maxWave)} m, enquanto o IPMA indica um estado do mar diário de ${formatMeters(official.totalSeaMin)} a ${formatMeters(official.totalSeaMax)} m para a costa de Lisboa. As duas fontes afastam-se, por isso a leitura fica incerta.`,
  };
}

function emptySpot(beach: Beach, fetchedAt: string, error: string): SpotForecast {
  return {
    spotId: beach.id,
    timezone: beach.timezone,
    fetchedAt,
    stale: false,
    marineOk: false,
    windOk: false,
    error,
    tide: {
      provider: "unavailable",
      ...TIDE_COPY.unavailable,
      approximateExtremes: true,
      extremes: [],
    },
    ipmaDaily: [],
    marineUncertain: false,
    uncertaintyNote: null,
    warnings: [],
    hours: [],
  };
}

export function resetForecastCache(): void {
  memory.clear();
  pending.clear();
}
