import { compassPhrase, normalizeDegrees } from "@/lib/angles";

export interface Arc {
  start: number;
  end: number;
}

export interface Beach {
  id: string;
  name: string;
  locality: string;
  council: string;
  latitude: number;
  longitude: number;
  timezone: "Europe/Lisbon";
  /** Direction you face when looking out to sea. */
  facingDeg: number;
  /** Swell directions, measured where the swell comes from, that can reach the beach. */
  swellWindow: Arc;
  idealSwell: Arc;
  /** Metres of swell that suit a competent surfer here, before skill is applied. */
  idealSwellHeight: { min: number; max: number };
  minSwellHeight: number;
  heavySwellHeight: number;
  idealPeriod: { min: number; max: number };
  /** Relative tide, 0 at low water and 1 at high water. */
  preferredTide: { min: number; max: number };
  preferredTidePhase: "rising" | "falling" | "any";
  /** When set, a beginner cannot score above this, because the spot is not suitable. */
  beginnerCap: number | null;
  advancedOnly: boolean;
  bottom: string;
  hazards: string[];
  summary: string;
  ipmaWarningArea: string;
  ipmaSeaLocalId: number;
}

export const BEACHES: Beach[] = [
  {
    id: "carcavelos",
    name: "Carcavelos",
    locality: "Carcavelos",
    council: "Cascais",
    latitude: 38.6774,
    longitude: -9.3392,
    timezone: "Europe/Lisbon",
    facingDeg: 255,
    swellWindow: { start: 220, end: 330 },
    idealSwell: { start: 260, end: 310 },
    idealSwellHeight: { min: 0.6, max: 1.6 },
    minSwellHeight: 0.3,
    heavySwellHeight: 2.4,
    idealPeriod: { min: 8, max: 14 },
    preferredTide: { min: 0.3, max: 0.75 },
    preferredTidePhase: "rising",
    beginnerCap: null,
    advancedOnly: false,
    bottom: "Areia",
    hazards: ["Muita gente na água", "Rebentação junto à areia com ondulação maior"],
    summary:
      "Praia de areia na linha de Cascais, aberta a oeste e sudoeste. Com ondulação pequena e vento de terra é das praias mais acessíveis de Lisboa.",
    ipmaWarningArea: "LSB",
    ipmaSeaLocalId: 1111026,
  },
  {
    id: "guincho",
    name: "Guincho",
    locality: "Guincho",
    council: "Cascais",
    latitude: 38.7322,
    longitude: -9.4726,
    timezone: "Europe/Lisbon",
    facingDeg: 275,
    swellWindow: { start: 240, end: 340 },
    idealSwell: { start: 270, end: 320 },
    idealSwellHeight: { min: 1.1, max: 2.4 },
    minSwellHeight: 0.6,
    heavySwellHeight: 3.2,
    idealPeriod: { min: 9, max: 15 },
    preferredTide: { min: 0.3, max: 0.7 },
    preferredTidePhase: "any",
    beginnerCap: 52,
    advancedOnly: false,
    bottom: "Areia",
    hazards: ["Correntes fortes", "Nortada frequente", "Ondas potentes e desencontradas"],
    summary:
      "Praia muito exposta a oeste. Apanha bem a ondulação de noroeste, mas o vento de norte e as correntes pedem respeito mesmo quando a direção da onda é boa.",
    ipmaWarningArea: "LSB",
    ipmaSeaLocalId: 1111026,
  },
  {
    id: "caparica",
    name: "Costa da Caparica",
    locality: "São João da Caparica",
    council: "Almada",
    latitude: 38.6364,
    longitude: -9.2356,
    timezone: "Europe/Lisbon",
    facingDeg: 265,
    swellWindow: { start: 210, end: 300 },
    idealSwell: { start: 240, end: 280 },
    idealSwellHeight: { min: 0.5, max: 1.5 },
    minSwellHeight: 0.3,
    heavySwellHeight: 2.2,
    idealPeriod: { min: 8, max: 13 },
    preferredTide: { min: 0.25, max: 0.8 },
    preferredTidePhase: "any",
    beginnerCap: null,
    advancedOnly: false,
    bottom: "Areia",
    hazards: ["Correntes junto aos esporões", "Bancos de areia que mudam"],
    summary:
      "Extensão de areia a sul do Tejo. Trabalha melhor com oeste e sudoeste do que com noroeste puro, e em dias pequenos é uma opção mais tranquila do que o Guincho.",
    ipmaWarningArea: "STB",
    ipmaSeaLocalId: 1111026,
  },
  {
    id: "fonte-da-telha",
    name: "Fonte da Telha",
    locality: "Fonte da Telha",
    council: "Almada",
    latitude: 38.5708,
    longitude: -9.1955,
    timezone: "Europe/Lisbon",
    facingDeg: 260,
    swellWindow: { start: 220, end: 315 },
    idealSwell: { start: 250, end: 295 },
    idealSwellHeight: { min: 0.7, max: 1.8 },
    minSwellHeight: 0.4,
    heavySwellHeight: 2.6,
    idealPeriod: { min: 8, max: 14 },
    preferredTide: { min: 0.3, max: 0.8 },
    preferredTidePhase: "any",
    beginnerCap: 60,
    advancedOnly: false,
    bottom: "Areia",
    hazards: ["Picos mais potentes do que na Caparica", "Acessos e estacionamento variáveis"],
    summary:
      "Mais exposta do que o centro da Caparica. A areia forma picos que aguentam um pouco mais de tamanho, sobretudo com oeste.",
    ipmaWarningArea: "STB",
    ipmaSeaLocalId: 1111026,
  },
  {
    id: "cresmina",
    name: "Cresmina",
    locality: "Cresmina",
    council: "Cascais",
    latitude: 38.7244,
    longitude: -9.4755,
    timezone: "Europe/Lisbon",
    facingDeg: 285,
    swellWindow: { start: 255, end: 345 },
    idealSwell: { start: 280, end: 325 },
    idealSwellHeight: { min: 1.3, max: 2.5 },
    minSwellHeight: 0.8,
    heavySwellHeight: 3.2,
    idealPeriod: { min: 10, max: 16 },
    preferredTide: { min: 0.45, max: 0.85 },
    preferredTidePhase: "rising",
    beginnerCap: 42,
    advancedOnly: true,
    bottom: "Areia com rocha",
    hazards: ["Rochas", "Correntes", "Onda pesada e rápida"],
    summary:
      "Pico pesado mesmo ao lado do Guincho. Precisa de noroeste com período e não é um sítio para aprender.",
    ipmaWarningArea: "LSB",
    ipmaSeaLocalId: 1111026,
  },
  {
    id: "sao-pedro",
    name: "São Pedro do Estoril",
    locality: "São Pedro do Estoril",
    council: "Cascais",
    latitude: 38.696,
    longitude: -9.371,
    timezone: "Europe/Lisbon",
    facingDeg: 250,
    swellWindow: { start: 230, end: 320 },
    idealSwell: { start: 255, end: 300 },
    idealSwellHeight: { min: 0.7, max: 1.7 },
    minSwellHeight: 0.4,
    heavySwellHeight: 2.3,
    idealPeriod: { min: 9, max: 15 },
    preferredTide: { min: 0.15, max: 0.55 },
    preferredTidePhase: "rising",
    beginnerCap: 48,
    advancedOnly: false,
    bottom: "Rocha e areia",
    hazards: ["Fundos de rocha", "Entrada e saída apertadas"],
    summary:
      "Recife entre Carcavelos e São João. Gosta de oeste com maré mais baixa e castiga quem não conhece a entrada.",
    ipmaWarningArea: "LSB",
    ipmaSeaLocalId: 1111026,
  },
  {
    id: "praia-grande",
    name: "Praia Grande",
    locality: "Colares",
    council: "Sintra",
    latitude: 38.817,
    longitude: -9.4775,
    timezone: "Europe/Lisbon",
    facingDeg: 310,
    swellWindow: { start: 270, end: 20 },
    idealSwell: { start: 290, end: 340 },
    idealSwellHeight: { min: 1.1, max: 2.4 },
    minSwellHeight: 0.6,
    heavySwellHeight: 3.4,
    idealPeriod: { min: 9, max: 16 },
    preferredTide: { min: 0.3, max: 0.75 },
    preferredTidePhase: "any",
    beginnerCap: 50,
    advancedOnly: false,
    bottom: "Areia",
    hazards: ["Ondulação de noroeste muito exposta", "Correntes", "Acesso por escadaria"],
    summary:
      "A costa de Sintra olha a noroeste, por isso esta praia acorda com ondulação de norte e noroeste que passa ao lado de praias mais viradas a oeste.",
    ipmaWarningArea: "LSB",
    ipmaSeaLocalId: 1111026,
  },
  {
    id: "ribeira-dilhas",
    name: "Ribeira d'Ilhas",
    locality: "Ericeira",
    council: "Mafra",
    latitude: 38.9886,
    longitude: -9.4214,
    timezone: "Europe/Lisbon",
    facingDeg: 300,
    swellWindow: { start: 270, end: 350 },
    idealSwell: { start: 290, end: 330 },
    idealSwellHeight: { min: 0.8, max: 2.1 },
    minSwellHeight: 0.4,
    heavySwellHeight: 2.8,
    idealPeriod: { min: 9, max: 16 },
    preferredTide: { min: 0.35, max: 0.85 },
    preferredTidePhase: "any",
    beginnerCap: 55,
    advancedOnly: false,
    bottom: "Rocha",
    hazards: ["Recife", "Muita gente na onda da direita", "Corrente junto à ponta"],
    summary:
      "A direita clássica da Ericeira. Abre com oeste-noroeste e período, e o vento de terra vem de este ou sudeste, não de norte.",
    ipmaWarningArea: "LSB",
    ipmaSeaLocalId: 1111026,
  },
];

export function getBeach(id: string): Beach | undefined {
  return BEACHES.find((beach) => beach.id === id);
}

export function offshoreSourceDeg(facingDeg: number): number {
  return normalizeDegrees(facingDeg + 180);
}

export function beachOrientationSentence(beach: Beach): string {
  const seaward = compassPhrase(beach.facingDeg);
  const offshore = compassPhrase(offshoreSourceDeg(beach.facingDeg));
  return `A praia olha para ${seaward}. O vento de terra vem de ${offshore}.`;
}
