import { CATEGORY_LABEL, type ScoreCategory } from "@/lib/config";
import type { ScoredHour } from "@/lib/scoring";
import { formatHourLabel, formatMeters } from "@/lib/time";
import type { TideExtreme } from "@/lib/tides";
import { windKindShort, type WindKind } from "@/lib/wind";

export function scoreClass(category: ScoreCategory | null): string {
  if (category === "excellent") return "score-excellent";
  if (category === "good") return "score-good";
  if (category === "fair") return "score-fair";
  return "score-poor";
}

export function ScoreMark({
  score,
  category,
  large = false,
  compact = false,
}: {
  score: number | null;
  category: ScoreCategory | null;
  large?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "text-right" : undefined}>
      <p
        className={`font-serif leading-none ${scoreClass(category)} ${
          large ? "text-7xl" : compact ? "text-2xl" : "text-4xl"
        }`}
      >
        {score ?? "–"}
      </p>
      {compact ? null : (
        <p className="mt-1 text-sm text-muted-foreground">
          {category ? CATEGORY_LABEL[category] : "Sem dados"} · previsão
        </p>
      )}
    </div>
  );
}

export function WindDial({
  facing,
  windFrom,
  kind,
}: {
  facing: number;
  windFrom: number | null;
  kind: WindKind | null;
}) {
  const toPoint = (degrees: number, radius: number) => {
    const radians = ((degrees - 90) * Math.PI) / 180;
    return [100 + Math.cos(radians) * radius, 100 + Math.sin(radians) * radius];
  };
  const sector = (center: number) => {
    const [x1, y1] = toPoint(center - 30, 78);
    const [x2, y2] = toPoint(center + 30, 78);
    return `M 100 100 L ${x1} ${y1} A 78 78 0 0 1 ${x2} ${y2} Z`;
  };
  const offshore = (facing + 180) % 360;
  const arrow = windFrom == null ? null : (windFrom + 180) % 360;
  const [ax, ay] = arrow == null ? [100, 100] : toPoint(arrow, 62);
  return (
    <svg viewBox="0 0 200 200" className="h-40 w-40" role="img" aria-label={kind ? `Vento ${windKindShort(kind)}` : "Sem vento"}>
      <circle cx="100" cy="100" r="78" fill="#f4f0e6" stroke="#0c2340" strokeOpacity="0.15" />
      <path d={sector(offshore)} fill="#1d6b4f" opacity="0.18" />
      <path d={sector(facing)} fill="#8d3d3d" opacity="0.12" />
      <text x="100" y="28" textAnchor="middle" fontSize="11" fill="#4d6274">
        N
      </text>
      {arrow != null ? (
        <line x1="100" y1="100" x2={ax} y2={ay} stroke="#0c2340" strokeWidth="2.5" strokeLinecap="round" />
      ) : null}
      <circle cx="100" cy="100" r="4" fill="#0f5f78" />
    </svg>
  );
}

export function HourlyChart({
  hours,
  selected,
  onSelect,
}: {
  hours: ScoredHour[];
  selected: string | null;
  onSelect: (time: string) => void;
}) {
  const width = 640;
  const height = 168;
  const pad = 16;
  const usable = Math.max(hours.length, 1);
  const step = (width - pad * 2) / usable;
  const maxWave = Math.max(1, ...hours.map((hour) => hour.sizeM ?? 0));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[640px]" role="img" aria-label="Pontuação e altura ao longo do dia">
        {hours.map((hour, index) => {
          const score = hour.score ?? 0;
          const barHeight = hour.score == null ? 4 : (score / 100) * 96;
          const x = pad + index * step + 2;
          const active = hour.time === selected;
          const color = hour.category === "excellent" ? "#1d6b4f" : hour.category === "good" ? "#0f5f78" : hour.category === "fair" ? "#9a6230" : "#8d3d3d";
          return (
            <g key={hour.time} onClick={() => onSelect(hour.time)} className="cursor-pointer">
              <rect x={x} y={24} width={Math.max(step - 4, 2)} height={110} fill={active ? "rgba(12,35,64,0.06)" : "transparent"} rx="6" />
              <rect
                x={x + 2}
                y={120 - barHeight}
                width={Math.max(step - 8, 2)}
                height={barHeight}
                rx="3"
                fill={hour.score == null ? "#d9d1c3" : color}
                opacity={active ? 1 : 0.85}
              />
              {index % 3 === 0 ? (
                <text x={x + step / 2} y="150" textAnchor="middle" fontSize="10" fill="#4d6274">
                  {formatHourLabel(hour.time)}
                </text>
              ) : null}
            </g>
          );
        })}
        <polyline
          fill="none"
          stroke="#0c2340"
          strokeWidth="2"
          points={hours
            .map((hour, index) => {
              const value = hour.sizeM ?? 0;
              const x = pad + index * step + step / 2;
              const y = 112 - (value / maxWave) * 78;
              return `${x},${y}`;
            })
            .join(" ")}
        />
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">Barras: pontuação. Linha: altura da ondulação, até {formatMeters(maxWave)} m.</p>
    </div>
  );
}

export function TideChart({
  hours,
  extremes,
  datum,
}: {
  hours: { time: string; level: number | null }[];
  extremes: TideExtreme[];
  datum: string;
}) {
  const known = hours.filter((hour): hour is { time: string; level: number } => hour.level != null);
  if (known.length < 2) {
    return <p className="text-sm text-muted-foreground">Sem curva de maré para este dia.</p>;
  }
  const width = 640;
  const height = 140;
  const min = Math.min(...known.map((hour) => hour.level));
  const max = Math.max(...known.map((hour) => hour.level));
  const span = Math.max(0.2, max - min);
  const points = known.map((hour, index) => {
    const x = 16 + (index / Math.max(known.length - 1, 1)) * (width - 32);
    const y = 20 + (1 - (hour.level - min) / span) * 90;
    return `${x},${y}`;
  });
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Curva de maré do dia">
        <polyline fill="none" stroke="#0f5f78" strokeWidth="2.5" points={points.join(" ")} />
        {extremes.map((extreme) => {
          const index = known.findIndex((hour) => hour.time === extreme.time);
          if (index < 0) return null;
          const x = 16 + (index / Math.max(known.length - 1, 1)) * (width - 32);
          const y = 20 + (1 - (extreme.levelM - min) / span) * 90;
          return (
            <g key={`${extreme.kind}-${extreme.time}`}>
              <circle cx={x} cy={y} r="3.5" fill={extreme.kind === "high" ? "#0c2340" : "#9a6230"} />
              <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fill="#12263a">
                {extreme.kind === "high" ? "Preia" : "Baixa"} {formatHourLabel(extreme.time)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-muted-foreground">{datum}</p>
    </div>
  );
}
