import { connection } from "next/server";
import type { NextRequest } from "next/server";
import { getForecastBundle } from "@/lib/forecast/service";

export async function GET(request: NextRequest) {
  await connection();
  const ids = request.nextUrl.searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean);
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const bundle = await getForecastBundle(ids, refresh);
  const nothing = bundle.spots.length > 0 && bundle.spots.every((spot) => !spot.marineOk && !spot.windOk);
  return Response.json(bundle, {
    status: nothing ? 503 : 200,
    headers: { "cache-control": "no-store" },
  });
}
