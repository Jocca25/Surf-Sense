"use client";

import dynamic from "next/dynamic";
import type { SpotReport } from "@/lib/report";

const InnerMap = dynamic(() => import("@/components/spot-map-inner"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-3xl bg-navy/10" />,
});

export function SpotMap({ reports }: { reports: SpotReport[] }) {
  return (
    <div className="spot-map h-80 overflow-hidden rounded-3xl ring-1 ring-foreground/10">
      <InnerMap reports={reports} />
    </div>
  );
}
