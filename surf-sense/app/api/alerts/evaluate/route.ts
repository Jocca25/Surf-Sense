import { getBeach } from "@/lib/beaches";
import { getForecastBundle } from "@/lib/forecast/service";
import { evaluateAlerts, type SentAlert } from "@/lib/notifications";
import { sanitizePreferences } from "@/lib/preferences";
import { buildSpotReport } from "@/lib/report";
import { z } from "zod";

const bodySchema = z.object({
  preferences: z.unknown(),
  alreadySent: z
    .array(
      z.object({
        id: z.string(),
        fingerprint: z.string(),
        sentAt: z.string(),
      }),
    )
    .default([]),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ message: "O pedido não é JSON válido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ message: "As preferências do alerta não são válidas." }, { status: 400 });
  }
  const preferences = sanitizePreferences(parsed.data.preferences);
  const bundle = await getForecastBundle();
  const now = new Date();
  const decisions = evaluateAlerts({
    now,
    preferences,
    alreadySent: parsed.data.alreadySent as SentAlert[],
    forecasts: bundle.spots.flatMap((forecast) => {
      const beach = getBeach(forecast.spotId);
      if (!beach || !forecast.marineOk) return [];
      const report = buildSpotReport(beach, forecast, preferences, now);
      return [
        {
          beach,
          hours: report.hours,
          windows: report.windows,
          stale: forecast.stale,
          uncertain: forecast.marineUncertain,
          forecastIssuedAt: forecast.fetchedAt,
        },
      ];
    }),
  });
  return Response.json({
    evaluatedAt: now.toISOString(),
    decisions: decisions.filter((decision) => decision.action !== "skip" || decision.reason !== "not-selected"),
  });
}
