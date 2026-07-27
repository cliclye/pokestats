import { NextResponse } from "next/server";
import { addReport, readStore } from "@/lib/store";
import type { StockStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("locationId");
  const store = await readStore();
  let reports = store.reports;
  if (locationId) reports = reports.filter((r) => r.locationId === locationId);
  return NextResponse.json({ reports: reports.slice(0, 50) });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    locationId?: string;
    productId?: string | null;
    status?: StockStatus;
    note?: string;
    reporterLabel?: string;
  };

  if (!body.locationId || !body.status) {
    return NextResponse.json({ error: "locationId and status required" }, { status: 400 });
  }

  const valid: StockStatus[] = ["in_stock", "out", "limited", "unknown"];
  if (!valid.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const store = await readStore();
  const location = store.locations.find((l) => l.id === body.locationId);
  if (!location) {
    return NextResponse.json({ error: "location not found" }, { status: 404 });
  }

  const report = {
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    locationId: body.locationId,
    productId: body.productId ?? null,
    status: body.status,
    note: (body.note || "").slice(0, 280),
    reporterLabel: (body.reporterLabel || "Anonymous").slice(0, 40),
    createdAt: new Date().toISOString(),
  };

  await addReport(report);
  return NextResponse.json({ report }, { status: 201 });
}
