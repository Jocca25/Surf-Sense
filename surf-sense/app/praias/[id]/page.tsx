import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpotDetail } from "@/components/spot-detail";
import { LoadingState } from "@/components/states";
import { BEACHES, getBeach } from "@/lib/beaches";

export function generateStaticParams() {
  return BEACHES.map((beach) => ({ id: beach.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const beach = getBeach(id);
  return { title: beach?.name ?? "Praia" };
}

export default function SpotPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <SpotGate params={params} />
    </Suspense>
  );
}

async function SpotGate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getBeach(id)) notFound();
  return <SpotDetail spotId={id} />;
}
