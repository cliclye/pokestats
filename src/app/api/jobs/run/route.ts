import { NextResponse } from "next/server";
import { upsertSetsAndCards, upsertSnapshots, upsertWebSignals, readStore } from "@/lib/store";
import { pollAllProducts, resultsToSnapshots } from "@/lib/stock/adapters";
import { collectWebSignals, signalsToSnapshots } from "@/lib/stock/web-signals";
import { syncRecentSets } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.JOBS_SECRET || "dev-local-secret";
  const header = request.headers.get("x-jobs-secret");
  return header === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    job?: "stock" | "prices" | "signals";
    setLimit?: number;
  };
  const store = await readStore();

  if (body.job === "prices") {
    const { sets, cards } = await syncRecentSets(body.setLimit ?? 4);
    await upsertSetsAndCards(sets, cards);
    return NextResponse.json({
      ok: true,
      sets: sets.length,
      cards: cards.length,
    });
  }

  if (body.job === "signals") {
    const signals = await collectWebSignals(store.products);
    const retailerIdBySlug = new Map(store.retailers.map((r) => [r.slug, r.id]));
    const snaps = signalsToSnapshots(signals, store.locations, retailerIdBySlug);
    await upsertWebSignals(signals, snaps);
    return NextResponse.json({
      ok: true,
      signals: signals.length,
      inStock: signals.filter((s) => s.status === "in_stock").length,
      snapshots: snaps.length,
    });
  }

  const results = await pollAllProducts(store.products, 1500);
  const retailerIdBySlug = new Map(store.retailers.map((r) => [r.slug, r.id]));
  const onlineLocationIdByRetailer = new Map(
    store.locations.filter((l) => l.type === "online").map((l) => [l.retailerId, l.id]),
  );
  const snapshots = resultsToSnapshots(results, retailerIdBySlug, onlineLocationIdByRetailer);
  await upsertSnapshots(snapshots);

  const signals = await collectWebSignals(store.products);
  const webSnaps = signalsToSnapshots(signals, store.locations, retailerIdBySlug);
  await upsertWebSignals(signals, webSnaps);

  return NextResponse.json({
    ok: true,
    polled: results.length,
    signals: signals.length,
    results: results.map((r) => ({
      retailer: r.retailerSlug,
      productId: r.productId,
      status: r.status,
      note: r.note,
    })),
  });
}
