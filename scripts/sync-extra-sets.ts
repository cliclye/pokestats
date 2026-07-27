#!/usr/bin/env tsx
import { promises as fs } from "fs";
import { fetchCardsForSet, fetchAllSets } from "../src/lib/pokemontcg";
import type { AppStore } from "../src/lib/types";

async function main() {
  const store = JSON.parse(await fs.readFile("data/store.json", "utf8")) as AppStore;
  const sets = await fetchAllSets();
  const setMap = new Map(store.sets.map((s) => [s.id, s]));
  for (const s of sets) setMap.set(s.id, s);
  store.sets = [...setMap.values()].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));

  for (const id of ["sv8", "sv8pt5", "me2"]) {
    try {
      const cards = await fetchCardsForSet(id);
      const cardMap = new Map(store.cards.map((c) => [c.id, c]));
      for (const c of cards) cardMap.set(c.id, c);
      store.cards = [...cardMap.values()];
      console.log(id, cards.length);
    } catch (e) {
      console.warn(id, e instanceof Error ? e.message : e);
    }
  }
  store.meta.pricesSyncedAt = new Date().toISOString();
  await fs.writeFile("data/store.json", JSON.stringify(store, null, 2));
  console.log("total cards", store.cards.length);
}

main();
