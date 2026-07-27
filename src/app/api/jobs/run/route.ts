import { NextResponse } from "next/server";
import { upsertSetsAndCards, upsertSnapshots, upsertWebSignals, readStore } from "@/lib/store";
import { pollAllProducts, resultsToSnapshots } from "@/lib/stock/adapters";
import { collectWebSignals, signalsToSnapshots } from "@/lib/stock/web-signals";
import { syncRecentSets } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type JobName = "stock" | "prices" | "signals";

function authorized(request: Request) {
  const secret = process.env.JOBS_SECRET || process.env.CRON_SECRET || "dev-local-secret";
  const header = request.headers.get("x-jobs-secret");
  const auth = request.headers.get("authorization");
  if (header && header === secret) return true;
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  if (auth && (auth === `Bearer ${secret}` || auth === `Bearer ${process.env.CRON_SECRET}`)) {
    return true;
  }
  return false;
}

async function runJob(job: JobName, setLimit = 4) {
  const store = await readStore();

  if (job === "prices") {
    const { sets, cards } = await syncRecentSets(setLimit);
    await upsertSetsAndCards(sets, cards);
    return {
      ok: true as const,
      job,
      sets: sets.length,
      cards: cards.length,
      at: new Date().toISOString(),
    };
  }

  if (job === "signals") {
    const signals = await collectWebSignals(store.products);
    const retailerIdBySlug = new Map(store.retailers.map((r) => [r.slug, r.id]));
    const snaps = signalsToSnapshots(signals, store.locations, retailerIdBySlug);
    await upsertWebSignals(signals, snaps);
    return {
      ok: true as const,
      job,
      signals: signals.length,
      inStock: signals.filter((s) => s.status === "in_stock").length,
      snapshots: snaps.length,
      at: new Date().toISOString(),
    };
  }

  // Full automatic stock check: retailer site polls + web scrapes
  const results = await pollAllProducts(store.products, 800);
  const retailerIdBySlug = new Map(store.retailers.map((r) => [r.slug, r.id]));
  const onlineLocationIdByRetailer = new Map(
    store.locations.filter((l) => l.type === "online").map((l) => [l.retailerId, l.id]),
  );
  const snapshots = resultsToSnapshots(results, retailerIdBySlug, onlineLocationIdByRetailer);
  await upsertSnapshots(snapshots);

  const signals = await collectWebSignals(store.products);
  const webSnaps = signalsToSnapshots(signals, store.locations, retailerIdBySlug);
  await upsertWebSignals(signals, webSnaps);

  return {
    ok: true as const,
    job,
    polled: results.length,
    known: results.filter((r) => r.status !== "unknown").length,
    inStock: results.filter((r) => r.status === "in_stock" || r.status === "limited").length,
    signals: signals.length,
    signalInStock: signals.filter((s) => s.status === "in_stock").length,
    results: results.map((r) => ({
      retailer: r.retailerSlug,
      productId: r.productId,
      status: r.status,
      note: r.note,
    })),
    at: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const job = (searchParams.get("job") || "signals") as JobName;
  if (!["stock", "prices", "signals"].includes(job)) {
    return NextResponse.json({ error: "invalid job" }, { status: 400 });
  }
  const setLimit = Number(searchParams.get("setLimit") || 4);
  try {
    const result = await runJob(job, setLimit);
    return NextResponse.json(result);
  } catch (err) {
    console.error("cron job failed", err);
    return NextResponse.json(
      {
        error: "job_failed",
        message: err instanceof Error ? err.message : JSON.stringify(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      job?: JobName;
      setLimit?: number;
    };
    const job = body.job || "stock";
    if (!["stock", "prices", "signals"].includes(job)) {
      return NextResponse.json({ error: "invalid job" }, { status: 400 });
    }
    const result = await runJob(job, body.setLimit ?? 4);
    return NextResponse.json(result);
  } catch (err) {
    console.error("job failed", err);
    return NextResponse.json(
      {
        error: "job_failed",
        message: err instanceof Error ? err.message : JSON.stringify(err),
      },
      { status: 500 },
    );
  }
}
