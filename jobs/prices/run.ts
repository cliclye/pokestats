#!/usr/bin/env tsx
/**
 * Price sync — caches pokemontcg.io sets/cards into data/store.json
 * Usage: npx tsx jobs/prices/run.ts
 *
 * Preserves existing locations/products/snapshots via upsert merge.
 */
import { upsertSetsAndCards } from "../../src/lib/store";
import { syncRecentSets } from "./sync";

async function main() {
  const limit = Number(process.env.PRICE_SYNC_SET_LIMIT || 6);
  console.log(`Syncing latest ${limit} sets from pokemontcg.io…`);
  const { sets, cards } = await syncRecentSets(limit);
  const priced = cards.filter((c) =>
    Object.values(c.prices || {}).some((p) => typeof p?.market === "number"),
  ).length;
  const store = await upsertSetsAndCards(sets, cards);
  console.log(
    `Saved ${store.sets.length} sets, ${store.cards.length} cards (${priced}/${cards.length} priced this run).`,
  );
  console.log(`Locations preserved: ${store.locations.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
