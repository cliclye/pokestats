import { NextResponse } from "next/server";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(Number(searchParams.get("limit") || 40), 100);

  const store = await readStore();
  let signals = store.webSignals || [];
  if (status) signals = signals.filter((s) => s.status === status);

  return NextResponse.json({
    signals: signals.slice(0, limit),
    meta: {
      webSignalsSyncedAt: store.meta.webSignalsSyncedAt ?? null,
      stockPolledAt: store.meta.stockPolledAt,
      total: signals.length,
    },
  });
}
