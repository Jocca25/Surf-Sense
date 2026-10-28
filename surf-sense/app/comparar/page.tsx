import { Suspense } from "react";
import type { Metadata } from "next";
import { CompareView } from "@/components/compare-view";
import { LoadingState } from "@/components/states";

export const metadata: Metadata = { title: "Comparar" };

export default function ComparePage() {
  return (
    <Suspense fallback={<LoadingState label="A preparar a comparação…" />}>
      <CompareView />
    </Suspense>
  );
}
