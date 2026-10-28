import type { TideExtreme } from "@/lib/tides";

export interface RawHour {
  time: string;
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  wavePeriodS: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  swellPeriodS: number | null;
  secondarySwellHeightM: number | null;
  secondarySwellDirectionDeg: number | null;
  secondarySwellPeriodS: number | null;
  windWaveHeightM: number | null;
  windWaveDirectionDeg: number | null;
  windWavePeriodS: number | null;
  seaLevelM: number | null;
  seaTemperatureC: number | null;
  windSpeedKmh: number | null;
  windDirectionDeg: number | null;
  windGustKmh: number | null;
  tideLevelM: number | null;
}

export interface IpmaWarning {
  text: string;
  awarenessTypeName: string;
  idAreaAviso: string;
  startTime: string;
  endTime: string;
  awarenessLevelID: string;
}

export interface IpmaDailySea {
  forecastDate: string;
  updatedAt: string;
  matchesQuery: boolean;
  waveHighMin: number | null;
  waveHighMax: number | null;
  periodMin: number | null;
  periodMax: number | null;
  totalSeaMin: number | null;
  totalSeaMax: number | null;
  direction: string | null;
  sstMin: number | null;
  sstMax: number | null;
}

export type TideProvider = "worldtides" | "open-meteo-sea-level" | "unavailable";

export interface TideMeta {
  provider: TideProvider;
  label: string;
  limitation: string;
  datum: string;
  approximateExtremes: boolean;
  extremes: TideExtreme[];
}

export interface SpotForecast {
  spotId: string;
  timezone: "Europe/Lisbon";
  fetchedAt: string;
  stale: boolean;
  marineOk: boolean;
  windOk: boolean;
  error: string | null;
  tide: TideMeta;
  ipmaDaily: IpmaDailySea[];
  /** True when today's Open-Meteo wave height and the IPMA daily sea state disagree by a wide margin. */
  marineUncertain: boolean;
  uncertaintyNote: string | null;
  warnings: IpmaWarning[];
  hours: RawHour[];
}

export interface ForecastBundle {
  fetchedAt: string;
  stale: boolean;
  spots: SpotForecast[];
  message: string | null;
}

export const TIDE_COPY = {
  worldtides: {
    label: "Maré da WorldTides",
    limitation:
      "Previsão de maré de um serviço externo. Continua a ser uma previsão astronómica e pode afastar-se do nível real com mau tempo.",
    datum: "Datum pedido à WorldTides (LAT, próximo do zero das cartas).",
  },
  openMeteo: {
    label: "Nível do mar do modelo Open-Meteo",
    limitation:
      "Este valor inclui a maré e o efeito da pressão atmosférica, mas o zero é o nível médio global do mar, não o zero hidrográfico português. Nas praias a precisão é limitada. Não substitui a Tabela de Marés do Instituto Hidrográfico e não serve para navegação. As horas de preia-mar e baixa-mar estão aproximadas à hora do modelo.",
    datum: "Nível médio global do mar, não o zero hidrográfico.",
  },
  unavailable: {
    label: "Maré indisponível",
    limitation: "Não foi possível obter uma maré utilizável nesta consulta. A pontuação não usa a maré.",
    datum: "Sem datum.",
  },
} as const;
