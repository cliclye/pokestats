#!/usr/bin/env tsx
/**
 * Backfill missing TCGPlayer markets for cached cards without wiping locations.
 * Usage: npx tsx scripts/enrich-missing-prices.ts
 */
import { readStore, upsertSetsAndCards } from "../src/lib/store";
import { cardHasPricedVariant, enrichCardsFromTcgplayer } from "../src/lib/tcgplayer";

async function main() {
  const store = await readStore();
  const missing = store.cards.filter((c) => !cardHasPricedVariant(c));
  console.log(`Locations: ${store.locations.length}`);
  console.log(`Cards missing prices: ${missing.length}/${store.cards.length}`);
  if (missing.length === 0) return;

  const enriched = await enrichCardsFromTcgplayer(missing, {
    concurrency: 5,
    delayMs: 70,
  });
  const filled = enriched.filter((c) => cardHasPricedVariant(c));
  await upsertSetsAndCards([], filled);
  console.log(`Enriched ${filled.length}/${missing.length} cards.`);
  console.log(`Sample:`, filled[0]?.id, filled[0]?.prices);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
