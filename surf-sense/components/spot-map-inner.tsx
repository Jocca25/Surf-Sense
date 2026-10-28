"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { SpotReport } from "@/lib/report";
import "leaflet/dist/leaflet.css";

function Fit({ reports }: { reports: SpotReport[] }) {
  const map = useMap();
  useEffect(() => {
    if (reports.length === 0) return;
    map.fitBounds(
      reports.map((report) => [report.beach.latitude, report.beach.longitude]),
      { padding: [28, 28] },
    );
  }, [map, reports]);
  return null;
}

export default function SpotMapInner({ reports }: { reports: SpotReport[] }) {
  return (
    <MapContainer center={[38.75, -9.4]} zoom={10} scrollWheelZoom={false} className="h-full w-full">
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Fit reports={reports} />
      {reports.map((report) => {
        const score = report.current?.score;
        const fill =
          report.current?.category === "excellent"
            ? "#1d6b4f"
            : report.current?.category === "good"
              ? "#0f5f78"
              : report.current?.category === "fair"
                ? "#9a6230"
                : "#8d3d3d";
        return (
          <CircleMarker
            key={report.beach.id}
            center={[report.beach.latitude, report.beach.longitude]}
            radius={score == null ? 7 : 8}
            pathOptions={{ color: "#0c2340", weight: 1, fillColor: fill, fillOpacity: 0.92 }}
          >
            <Popup>
              <strong>{report.beach.name}</strong>
              <br />
              {score == null ? "Sem pontuação" : `${score}/100`}
              <br />
              <Link href={`/praias/${report.beach.id}`}>Abrir a praia</Link>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
