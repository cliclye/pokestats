#!/usr/bin/env tsx
/**
 * Scrape public restock / stock pages and merge into store.
 * Usage: npx tsx jobs/stock/web-signals.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { createEmptyStore, RETAILERS } from "../../src/lib/seed";
import type { AppStore } from "../../src/lib/types";
import {
  collectWebSignals,
  signalsToSnapshots,
} from "../../src/lib/stock/web-signals";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");

async function atomicWrite(file: string, data: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

async function loadStore(): Promise<AppStore> {
  try {
    const store = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as AppStore;
    if (!store.webSignals) store.webSignals = [];
    if (!store.meta.webSignalsSyncedAt) store.meta.webSignalsSyncedAt = null;
    return store;
  } catch {
    return createEmptyStore();
  }
}

async function main() {
  const store = await loadStore();
  // Ensure amazon retailer present
  for (const r of RETAILERS) {
    if (!store.retailers.some((x) => x.id === r.id)) store.retailers.push(r);
  }

  console.log("Collecting public web stock signals…");
  const signals = await collectWebSignals(store.products);
  console.log(`Got ${signals.length} signals`);

  const retailerIdBySlug = new Map(store.retailers.map((r) => [r.slug, r.id]));
  const snaps = signalsToSnapshots(signals, store.locations, retailerIdBySlug);

  const byId = new Map((store.webSignals || []).map((s) => [s.id, s]));
  for (const s of signals) byId.set(s.id, s);
  store.webSignals = [...byId.values()]
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, 300);
  store.meta.webSignalsSyncedAt = new Date().toISOString();

  for (const snap of snaps) {
    const idx = store.snapshots.findIndex(
      (s) =>
        s.locationId === snap.locationId &&
        s.productId === snap.productId &&
        s.retailerId === snap.retailerId &&
        s.source === snap.source,
    );
    if (idx >= 0) store.snapshots[idx] = snap;
    else store.snapshots.push(snap);
  }
  if (snaps.length) store.meta.stockPolledAt = new Date().toISOString();

  if (!store.locations.some((l) => l.externalId === "amz-online")) {
    store.locations.push({
      id: "online-amazon",
      retailerId: "r-amazon",
      name: "Amazon.com Online",
      type: "online",
      lat: 47.6225,
      lng: -122.337,
      address: "Online",
      city: "Seattle",
      state: "WA",
      zip: "98109",
      externalId: "amz-online",
    });
  }

  await atomicWrite(STORE_PATH, JSON.stringify(store));

  const inStock = signals.filter((s) => s.status === "in_stock").length;
  const out = signals.filter((s) => s.status === "out").length;
  console.log(`Saved. in_stock=${inStock} out=${out} snapshots+=${snaps.length}`);
  for (const s of signals.filter((x) => x.status === "in_stock").slice(0, 12)) {
    console.log(`  ✓ [${s.retailerSlug}] ${s.productName}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
