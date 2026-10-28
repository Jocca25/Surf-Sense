import { fetchJson, isRecord, UpstreamError } from "@/lib/forecast/http";
import { utcToZonedLocalIso } from "@/lib/time";
import type { TideExtreme } from "@/lib/tides";

export interface WorldTidesResult {
  levels: { time: string; levelM: number }[];
  extremes: TideExtreme[];
}

export function worldTidesConfigured(): boolean {
  return Boolean(process.env.WORLDTIDES_API_KEY);
}

export async function fetchWorldTides(latitude: number, longitude: number): Promise<WorldTidesResult> {
  const key = process.env.WORLDTIDES_API_KEY;
  if (!key) throw new UpstreamError("WORLDTIDES_API_KEY não está definida.");
  const url = new URL("https://www.worldtides.info/api/v3");
  url.searchParams.set("heights", "");
  url.searchParams.set("extremes", "");
  url.searchParams.set("datum", "LAT");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("days", "7");
  url.searchParams.set("step", "3600");
  url.searchParams.set("key", key);
  const payload = await fetchJson(url.toString());
  return parseWorldTides(payload);
}

export function parseWorldTides(payload: unknown): WorldTidesResult {
  if (!isRecord(payload)) throw new UpstreamError("A WorldTides não devolveu um objeto.");
  if (typeof payload.status === "number" && payload.status !== 200) {
    const message = typeof payload.error === "string" ? payload.error : "A WorldTides recusou o pedido.";
    throw new UpstreamError(message);
  }
  const heights = Array.isArray(payload.heights) ? payload.heights : [];
  const extremes = Array.isArray(payload.extremes) ? payload.extremes : [];
  const levels = heights.flatMap((item) => {
    if (!isRecord(item) || typeof item.dt !== "number" || typeof item.height !== "number") return [];
    return [{ time: utcToZonedLocalIso(new Date(item.dt * 1000), "Europe/Lisbon"), levelM: item.height }];
  });
  const parsedExtremes = extremes.flatMap((item) => {
    if (!isRecord(item) || typeof item.dt !== "number" || typeof item.height !== "number") return [];
    const kind = String(item.type).toLowerCase().includes("high") ? "high" : "low";
    return [
      {
        time: utcToZonedLocalIso(new Date(item.dt * 1000), "Europe/Lisbon"),
        levelM: item.height,
        kind: kind as "high" | "low",
        approximate: false,
      },
    ];
  });
  if (levels.length === 0) throw new UpstreamError("A WorldTides não devolveu alturas.");
  return { levels, extremes: parsedExtremes };
}
