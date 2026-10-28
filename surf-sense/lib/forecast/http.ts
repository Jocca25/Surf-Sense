export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export async function fetchJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new UpstreamError(`O serviço respondeu com o código ${response.status}.`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new UpstreamError("O pedido de previsão expirou.");
    }
    throw new UpstreamError("Não foi possível contactar o serviço de previsão.");
  } finally {
    clearTimeout(timer);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function asSeries(value: unknown, length: number): (number | null)[] {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => asNumber(source[index]));
}

export function requireHourly(payload: unknown, source: string): { time: string[]; hourly: Record<string, unknown> } {
  if (!isRecord(payload)) throw new UpstreamError(`A resposta de ${source} não é um objeto.`);
  if (payload.error === true) {
    throw new UpstreamError(
      typeof payload.reason === "string" ? payload.reason : `${source} recusou o pedido.`,
    );
  }
  if (!isRecord(payload.hourly) || !Array.isArray(payload.hourly.time)) {
    throw new UpstreamError(`${source} não devolveu horas.`);
  }
  const time = payload.hourly.time.filter((item): item is string => typeof item === "string");
  if (time.length === 0) throw new UpstreamError(`${source} devolveu uma lista de horas vazia.`);
  return { time, hourly: payload.hourly };
}
