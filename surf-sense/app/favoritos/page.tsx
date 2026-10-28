import type { Metadata } from "next";
import { SpotsBrowser } from "@/components/spots-browser";

export const metadata: Metadata = { title: "Favoritas" };

export default function FavoritesPage() {
  return <SpotsBrowser favoritesOnly />;
}
