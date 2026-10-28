import type { Metadata } from "next";
import { PreferencesView } from "@/components/preferences-view";

export const metadata: Metadata = { title: "Preferências" };

export default function PreferencesPage() {
  return <PreferencesView />;
}
