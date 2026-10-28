import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { getBeach } from "@/lib/beaches";
import type { SurfSessionFeedback } from "@/lib/history";
import { z } from "zod";

const bodySchema = z.object({
  spotId: z.string(),
  sessionTime: z.string().min(16),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ message: "O pedido não é JSON válido." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success || !getBeach(parsed.data.spotId)) {
    return Response.json({ message: "Não consegui guardar essa nota." }, { status: 400 });
  }
  const entry: SurfSessionFeedback = {
    id: `${parsed.data.spotId}-${Date.now()}`,
    spotId: parsed.data.spotId,
    sessionTime: parsed.data.sessionTime.slice(0, 16),
    rating: parsed.data.rating,
    note: parsed.data.note?.trim() || undefined,
    recordedAt: new Date().toISOString(),
  };
  try {
    await writeFeedback(entry);
  } catch {
    return Response.json(
      { message: "A nota não ficou guardada neste servidor. A pontuação não mudou." },
      { status: 500 },
    );
  }
  return Response.json({
    saved: true,
    message: "Obrigado. Guardei a tua nota. Ela ainda não altera a pontuação.",
  });
}

async function writeFeedback(entry: SurfSessionFeedback) {
  const preferred = process.env.FEEDBACK_DIR || path.join(process.cwd(), ".data");
  const directories = [preferred, "/tmp/barlavento"];
  let lastError: unknown;
  for (const directory of directories) {
    try {
      await mkdir(directory, { recursive: true });
      await appendFile(path.join(directory, "feedback.jsonl"), `${JSON.stringify(entry)}\n`, "utf8");
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
