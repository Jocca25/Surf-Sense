import { asNumber, fetchJson, isRecord } from "@/lib/forecast/http";
import type { IpmaDailySea, IpmaWarning } from "@/lib/forecast/types";

const BASE = "https://api.ipma.pt/open-data";

export interface IpmaBundle {
  warnings: IpmaWarning[];
  daily: IpmaDailySea[];
  error: string | null;
}

export async function fetchIpma(seaLocalId: number): Promise<IpmaBundle> {
  const [warningsResult, ...days] = await Promise.allSettled([
    fetchJson(`${BASE}/forecast/warnings/warnings_www.json`),
    fetchJson(`${BASE}/forecast/oceanography/daily/hp-daily-sea-forecast-day0.json`),
    fetchJson(`${BASE}/forecast/oceanography/daily/hp-daily-sea-forecast-day1.json`),
    fetchJson(`${BASE}/forecast/oceanography/daily/hp-daily-sea-forecast-day2.json`),
  ]);

  const warnings = warningsResult.status === "fulfilled" ? parseWarnings(warningsResult.value) : [];
  const daily = days.flatMap((result) =>
    result.status === "fulfilled" ? parseDaily(result.value, seaLocalId) : [],
  );
  const failed = [warningsResult, ...days].filter((result) => result.status === "rejected").length;
  return {
    warnings,
    daily,
    error: failed === 4 ? "Os dados do IPMA não estão disponíveis nesta consulta." : null,
  };
}

export function parseWarnings(payload: unknown): IpmaWarning[] {
  if (!Array.isArray(payload)) return [];
  const warnings: IpmaWarning[] = [];
  for (const item of payload) {
    if (!isRecord(item)) continue;
    const level = typeof item.awarenessLevelID === "string" ? item.awarenessLevelID.toLowerCase() : "";
    if (level !== "yellow" && level !== "orange" && level !== "red") continue;
    if (typeof item.awarenessTypeName !== "string" || typeof item.idAreaAviso !== "string") continue;
    if (typeof item.startTime !== "string" || typeof item.endTime !== "string") continue;
    warnings.push({
      text: typeof item.text === "string" ? item.text : "",
      awarenessTypeName: item.awarenessTypeName,
      idAreaAviso: item.idAreaAviso,
      startTime: item.startTime,
      endTime: item.endTime,
      awarenessLevelID: level,
    });
  }
  return warnings;
}

export function parseDaily(payload: unknown, seaLocalId: number): IpmaDailySea[] {
  if (!isRecord(payload) || !Array.isArray(payload.data) || typeof payload.forecastDate !== "string") return [];
  const row = payload.data.find((item) => isRecord(item) && Number(item.globalIdLocal) === seaLocalId);
  if (!row || !isRecord(row)) return [];
  return [
    {
      forecastDate: payload.forecastDate,
      updatedAt: typeof payload.dataUpdate === "string" ? payload.dataUpdate : "",
      matchesQuery: true,
      waveHighMin: asNumber(row.waveHighMin),
      waveHighMax: asNumber(row.waveHighMax),
      periodMin: asNumber(row.wavePeriodMin),
      periodMax: asNumber(row.wavePeriodMax),
      totalSeaMin: asNumber(row.totalSeaMin),
      totalSeaMax: asNumber(row.totalSeaMax),
      direction: typeof row.predWaveDir === "string" ? row.predWaveDir : null,
      sstMin: asNumber(row.sstMin),
      sstMax: asNumber(row.sstMax),
    },
  ];
}
