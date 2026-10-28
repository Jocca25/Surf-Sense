import type { Metadata } from "next";
import { SpotsBrowser } from "@/components/spots-browser";

export const metadata: Metadata = { title: "Praias" };

export default function PraiasPage() {
  return <SpotsBrowser />;
}
