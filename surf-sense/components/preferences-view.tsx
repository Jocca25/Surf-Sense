"use client";

import { useApp } from "@/components/app-provider";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS, type ScoreWeights } from "@/lib/config";
import { BEACHES } from "@/lib/beaches";
import {
  SKILL_LABEL,
  SWELL_PREFERENCE_LABEL,
  TIDE_PREFERENCE_LABEL,
  type Skill,
  type SwellPreference,
  type TidePreference,
} from "@/lib/preferences";

const WEIGHT_LABELS: { key: keyof ScoreWeights; label: string }[] = [
  { key: "swellHeight", label: "Altura" },
  { key: "swellDirection", label: "Direção da ondulação" },
  { key: "swellPeriod", label: "Período" },
  { key: "windDirection", label: "Direção do vento" },
  { key: "windSpeed", label: "Força do vento" },
  { key: "tide", label: "Maré" },
];

export function PreferencesView() {
  const { preferences, updatePreferences, toggleFavorite } = useApp();
  const weights = preferences.weights ?? DEFAULT_WEIGHTS;
  const thresholds = preferences.thresholds ?? DEFAULT_THRESHOLDS;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <h1 className="font-serif text-4xl text-navy">Preferências</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A mesma ondulação não serve um iniciante e alguém que procura uma onda grande. A pontuação muda contigo, sem inventar o mar.
        </p>
      </header>

      <section className="space-y-4 rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <Choice
          label="Nível"
          value={preferences.skill}
          items={SKILL_LABEL}
          onChange={(skill) => updatePreferences({ skill: skill as Skill })}
        />
        <label className="block space-y-2 text-sm">
          <span>
            Altura que te interessa: {preferences.waveMinM.toFixed(1)}–{preferences.waveMaxM.toFixed(1)} m
          </span>
          <Slider
            min={0.2}
            max={4}
            step={0.1}
            value={[preferences.waveMinM, preferences.waveMaxM]}
            onValueChange={(value) => {
              const pair = sliderPair(value);
              if (!pair) return;
              updatePreferences({ waveMinM: Math.min(pair[0], pair[1]), waveMaxM: Math.max(pair[0], pair[1]) });
            }}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Pontuação mínima para uma janela: {Math.round(preferences.minScore)}</span>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[preferences.minScore]}
            onValueChange={(value) => updatePreferences({ minScore: sliderNumber(value, preferences.minScore) })}
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Vento máximo que ainda te serve: {Math.round(preferences.maxWindKmh)} km/h</span>
          <Slider
            min={5}
            max={80}
            step={1}
            value={[preferences.maxWindKmh]}
            onValueChange={(value) => updatePreferences({ maxWindKmh: sliderNumber(value, preferences.maxWindKmh) })}
          />
        </label>
        <Choice
          label="Ondulação"
          value={preferences.swellPreference}
          items={SWELL_PREFERENCE_LABEL}
          onChange={(value) => updatePreferences({ swellPreference: value as SwellPreference })}
        />
        <Choice
          label="Maré"
          value={preferences.tidePreference}
          items={TIDE_PREFERENCE_LABEL}
          onChange={(value) => updatePreferences({ tidePreference: value as TidePreference })}
        />
      </section>

      <section className="rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl text-navy">Praias guardadas</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {BEACHES.map((beach) => {
            const on = preferences.favoriteIds.includes(beach.id);
            return (
              <button
                key={beach.id}
                type="button"
                onClick={() => toggleFavorite(beach.id)}
                className={`rounded-full px-3 py-1.5 text-sm ring-1 ${on ? "bg-navy text-primary-foreground ring-navy" : "ring-foreground/15"}`}
              >
                {beach.name}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-3xl bg-paper p-5 ring-1 ring-foreground/10">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-navy">Pesos e faixas</h2>
          <button
            type="button"
            className="text-sm text-ocean"
            onClick={() => updatePreferences({ weights: null, thresholds: null })}
          >
            Repor
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Os pesos dizem o que pesa mais na média. As faixas decidem quando a pontuação se chama excelente, boa, razoável ou fraca. O risco continua a impedir que um dia perigoso fique excelente.
        </p>
        {WEIGHT_LABELS.map((item) => (
          <label key={item.key} className="block space-y-2 text-sm">
            <span>
              {item.label}: {Math.round(weights[item.key] * 100)}
            </span>
            <Slider
              min={0}
              max={40}
              step={1}
              value={[Math.round(weights[item.key] * 100)]}
              onValueChange={(value) =>
                updatePreferences({
                  weights: { ...weights, [item.key]: sliderNumber(value, 0) / 100 },
                })
              }
            />
          </label>
        ))}
        <label className="block space-y-2 text-sm">
          <span>Excelente a partir de {thresholds.excellent}</span>
          <Slider
            min={70}
            max={100}
            step={1}
            value={[thresholds.excellent]}
            onValueChange={(value) =>
              updatePreferences({
                thresholds: { ...thresholds, excellent: sliderNumber(value, thresholds.excellent) },
              })
            }
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Bom a partir de {thresholds.good}</span>
          <Slider
            min={40}
            max={90}
            step={1}
            value={[thresholds.good]}
            onValueChange={(value) =>
              updatePreferences({ thresholds: { ...thresholds, good: sliderNumber(value, thresholds.good) } })
            }
          />
        </label>
        <label className="block space-y-2 text-sm">
          <span>Razoável a partir de {thresholds.fair}</span>
          <Slider
            min={10}
            max={70}
            step={1}
            value={[thresholds.fair]}
            onValueChange={(value) =>
              updatePreferences({ thresholds: { ...thresholds, fair: sliderNumber(value, thresholds.fair) } })
            }
          />
        </label>
      </section>
    </div>
  );
}

function sliderNumber(value: number | readonly number[], fallback: number): number {
  const next = Array.isArray(value) ? value[0] : value;
  return next ?? fallback;
}

function sliderPair(value: number | readonly number[]): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  return [value[0], value[1]];
}

function Choice<T extends string>({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: T;
  items: Record<T, string>;
  onChange: (value: T) => void;
}) {
  const entries = Object.entries(items) as [T, string][];
  const selectItems = entries.map(([key, text]) => ({ value: key, label: text }));
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} items={selectItems} onValueChange={(next) => next && onChange(next as T)}>
        <SelectTrigger className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {entries.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
