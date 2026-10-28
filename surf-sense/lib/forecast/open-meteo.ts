import { asSeries, fetchJson, requireHourly } from "@/lib/forecast/http";
import type { RawHour } from "@/lib/forecast/types";

const MARINE_URL = process.env.OPEN_METEO_MARINE_URL ?? "https://marine-api.open-meteo.com/v1/marine";
const WEATHER_URL = process.env.OPEN_METEO_WEATHER_URL ?? "https://api.open-meteo.com/v1/forecast";

const MARINE_VARS = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "swell_wave_height",
  "swell_wave_direction",
  "swell_wave_period",
  "secondary_swell_wave_height",
  "secondary_swell_wave_direction",
  "secondary_swell_wave_period",
  "wind_wave_height",
  "wind_wave_direction",
  "wind_wave_period",
  "sea_level_height_msl",
  "sea_surface_temperature",
];

export interface OpenMeteoHours {
  hours: Omit<RawHour, "tideLevelM">[];
  marineOk: boolean;
  windOk: boolean;
  marineError: string | null;
  windError: string | null;
}

export async function fetchOpenMeteo(latitude: number, longitude: number): Promise<OpenMeteoHours> {
  const marineUrl = new URL(MARINE_URL);
  marineUrl.searchParams.set("latitude", String(latitude));
  marineUrl.searchParams.set("longitude", String(longitude));
  marineUrl.searchParams.set("hourly", MARINE_VARS.join(","));
  marineUrl.searchParams.set("timezone", "Europe/Lisbon");
  marineUrl.searchParams.set("forecast_days", "7");
  marineUrl.searchParams.set("cell_selection", "sea");
  marineUrl.searchParams.set("length_unit", "metric");

  const weatherUrl = new URL(WEATHER_URL);
  weatherUrl.searchParams.set("latitude", String(latitude));
  weatherUrl.searchParams.set("longitude", String(longitude));
  weatherUrl.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m,wind_gusts_10m");
  weatherUrl.searchParams.set("timezone", "Europe/Lisbon");
  weatherUrl.searchParams.set("forecast_days", "7");
  weatherUrl.searchParams.set("wind_speed_unit", "kmh");

  const [marineResult, weatherResult] = await Promise.allSettled([
    fetchJson(marineUrl.toString()),
    fetchJson(weatherUrl.toString()),
  ]);

  let marine: ReturnType<typeof requireHourly> | null = null;
  let marineError: string | null = null;
  if (marineResult.status === "fulfilled") {
    try {
      marine = requireHourly(marineResult.value, "Open-Meteo Marine");
    } catch (error) {
      marineError = error instanceof Error ? error.message : "A resposta do mar não pôde ser lida.";
    }
  } else {
    marineError = marineResult.reason instanceof Error ? marineResult.reason.message : "Falha no mar.";
  }

  let weather: ReturnType<typeof requireHourly> | null = null;
  let windError: string | null = null;
  if (weatherResult.status === "fulfilled") {
    try {
      weather = requireHourly(weatherResult.value, "Open-Meteo");
    } catch (error) {
      windError = error instanceof Error ? error.message : "A resposta do vento não pôde ser lida.";
    }
  } else {
    windError = weatherResult.reason instanceof Error ? weatherResult.reason.message : "Falha no vento.";
  }

  if (!marine && !weather) {
    throw new Error(marineError ?? windError ?? "Sem dados de previsão.");
  }

  const time = marine?.time ?? weather?.time ?? [];
  const weatherByTime = new Map<string, number>();
  weather?.time.forEach((stamp, index) => weatherByTime.set(stamp, index));

  const marineSeries = marine
    ? Object.fromEntries(MARINE_VARS.map((key) => [key, asSeries(marine.hourly[key], marine.time.length)]))
    : null;
  const windSpeed = weather ? asSeries(weather.hourly.wind_speed_10m, weather.time.length) : [];
  const windDirection = weather ? asSeries(weather.hourly.wind_direction_10m, weather.time.length) : [];
  const windGust = weather ? asSeries(weather.hourly.wind_gusts_10m, weather.time.length) : [];

  const hours = time.map((stamp, index) => {
    const windIndex = weatherByTime.get(stamp);
    const at = (key: string) => marineSeries?.[key]?.[index] ?? null;
    return {
      time: stamp.slice(0, 16),
      waveHeightM: at("wave_height"),
      waveDirectionDeg: at("wave_direction"),
      wavePeriodS: at("wave_period"),
      swellHeightM: at("swell_wave_height"),
      swellDirectionDeg: at("swell_wave_direction"),
      swellPeriodS: at("swell_wave_period"),
      secondarySwellHeightM: at("secondary_swell_wave_height"),
      secondarySwellDirectionDeg: at("secondary_swell_wave_direction"),
      secondarySwellPeriodS: at("secondary_swell_wave_period"),
      windWaveHeightM: at("wind_wave_height"),
      windWaveDirectionDeg: at("wind_wave_direction"),
      windWavePeriodS: at("wind_wave_period"),
      seaLevelM: at("sea_level_height_msl"),
      seaTemperatureC: at("sea_surface_temperature"),
      windSpeedKmh: windIndex == null ? null : windSpeed[windIndex] ?? null,
      windDirectionDeg: windIndex == null ? null : windDirection[windIndex] ?? null,
      windGustKmh: windIndex == null ? null : windGust[windIndex] ?? null,
    };
  });

  return {
    hours,
    marineOk: marine != null,
    windOk: weather != null,
    marineError,
    windError,
  };
}
