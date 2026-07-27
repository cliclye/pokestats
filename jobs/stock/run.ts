#!/usr/bin/env tsx
/**
 * Stock sync: retailer product polls + public web restock scrapes.
 * Usage: npx tsx jobs/stock/run.ts
 */
import { promises as fs } from "fs";
import path from "path";
import { createEmptyStore, RETAILERS } from "../../src/lib/seed";
import type { AppStore } from "../../src/lib/types";
import { pollAllProducts, resultsToSnapshots } from "./adapters";
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
    const store = createEmptyStore();
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await atomicWrite(STORE_PATH, JSON.stringify(store));
    return store;
  }
}

async function main() {
  const store = await loadStore();
  for (const r of RETAILERS) {
    if (!store.retailers.some((x) => x.id === r.id)) store.retailers.push(r);
  }

  console.log(`1/2 Polling ${store.products.length} sealed products on retailer sites…`);
  const results = await pollAllProducts(store.products, 1500);
  const retailerIdBySlug = new Map(store.retailers.map((r) => [r.slug, r.id]));
  const onlineLocationIdByRetailer = new Map(
    store.locations.filter((l) => l.type === "online").map((l) => [l.retailerId, l.id]),
  );
  const pollSnaps = resultsToSnapshots(results, retailerIdBySlug, onlineLocationIdByRetailer);

  console.log("2/2 Scraping NowInStock + public restock posts…");
  const signals = await collectWebSignals(store.products);
  const webSnaps = signalsToSnapshots(signals, store.locations, retailerIdBySlug);

  for (const snap of [...pollSnaps, ...webSnaps]) {
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

  const byId = new Map((store.webSignals || []).map((s) => [s.id, s]));
  for (const s of signals) byId.set(s.id, s);
  store.webSignals = [...byId.values()]
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, 300);

  store.meta.stockPolledAt = new Date().toISOString();
  store.meta.webSignalsSyncedAt = new Date().toISOString();

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

  const summary = results.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log("Retailer poll:", summary);
  console.log(
    `Web signals: ${signals.length} (in_stock ${signals.filter((s) => s.status === "in_stock").length})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
