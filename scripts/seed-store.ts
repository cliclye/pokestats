#!/usr/bin/env tsx
import { promises as fs } from "fs";
import path from "path";
import { createEmptyStore } from "../src/lib/seed";
import type { AppStore, Location } from "../src/lib/types";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");

async function main() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  let existing: AppStore | null = null;
  try {
    existing = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as AppStore;
  } catch {
    // fresh
  }

  // Prefer nationwide import artifact if present
  let importedLocations: Location[] | null = null;
  try {
    const locFile = JSON.parse(
      await fs.readFile(path.join(process.cwd(), "data", "locations.json"), "utf8"),
    ) as { locations?: Location[] };
    if (Array.isArray(locFile.locations) && locFile.locations.length > 100) {
      importedLocations = locFile.locations;
    }
  } catch {
    // no import yet
  }

  const store = createEmptyStore();
  if (importedLocations) store.locations = importedLocations;
  else if (existing?.locations?.length) store.locations = existing.locations;
  if (existing?.cards?.length) store.cards = existing.cards;
  if (existing?.sets?.length) store.sets = existing.sets;
  if (existing?.snapshots?.length) store.snapshots = existing.snapshots;
  if (existing?.reports?.length) store.reports = existing.reports;
  if (existing?.meta) store.meta = { ...store.meta, ...existing.meta };
  if (existing?.products?.length) store.products = existing.products;
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2));
  console.log(
    `Seeded ${store.locations.length} locations, ${store.products.length} products → ${STORE_PATH}`,
  );
}

main();
