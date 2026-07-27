#!/usr/bin/env tsx
/**
 * Fast OSM top-up for Walmart / Best Buy / GameStop / Sam's Club.
 * Uses bbox grid (no area queries) — more reliable than state areas.
 * Merges into existing data/store.json + data/locations.json.
 *
 * Usage: npm run import:locations:osm
 */
import { promises as fs } from "fs";
import path from "path";
import { RETAILERS } from "../src/lib/seed";
import type { AppStore, Location, RetailerSlug } from "../src/lib/types";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");
const LOCATIONS_PATH = path.join(process.cwd(), "data", "locations.json");
const OVERPASS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

/** ~8° cells — fewer requests, still fits Overpass timeouts */
const GRID: Array<[number, number, number, number]> = [];
(function build() {
  for (let s = 24; s < 50; s += 8) {
    for (let w = -125; w < -66; w += 8) {
      GRID.push([s, w, Math.min(s + 8.5, 50), Math.min(w + 8.5, -66)]);
    }
  }
  GRID.push([51, -170, 72, -130], [18.5, -161, 22.5, -154]);
})();

type Brand = {
  key: string;
  slug: RetailerSlug;
  retailerId: string;
  label: string;
  filters: string[];
};

const BRANDS: Brand[] = [
  {
    key: "walmart",
    slug: "walmart",
    retailerId: "r-walmart",
    label: "Walmart",
    filters: [
      '["brand:wikidata"="Q483551"]',
      '["brand"="Walmart"]',
      '["name"~"^Walmart",i]',
    ],
  },
  {
    key: "sams",
    slug: "walmart",
    retailerId: "r-walmart",
    label: "Sam's Club",
    filters: ['["brand:wikidata"="Q1970340"]', '["brand"="Sam\'s Club"]'],
  },
  {
    key: "bestbuy",
    slug: "best-buy",
    retailerId: "r-best-buy",
    label: "Best Buy",
    filters: [
      '["brand:wikidata"="Q533415"]',
      '["brand"="Best Buy"]',
      '["name"="Best Buy"]',
    ],
  },
  {
    key: "gamestop",
    slug: "gamestop",
    retailerId: "r-gamestop",
    label: "GameStop",
    filters: [
      '["brand:wikidata"="Q696140"]',
      '["brand"="GameStop"]',
      '["name"="GameStop"]',
    ],
  },
  {
    key: "pokemon-center",
    slug: "pokemon-center",
    retailerId: "r-pokemon-center",
    label: "Pokémon Center",
    filters: ['["name"~"Pokémon Center|Pokemon Center",i]'],
  },
];

interface El {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function overpass(query: string): Promise<El[]> {
  let last: unknown;
  for (const url of OVERPASS) {
    for (let a = 0; a < 2; a++) {
      try {
        console.log(`    POST ${url.split("/")[2]} (attempt ${a + 1})…`);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "PokeStats/1.0 (bbox OSM import)",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(90_000),
        });
        if (res.status === 429 || res.status >= 500) {
          await sleep(4000 * (a + 1));
          continue;
        }
        if (!res.ok) {
          last = new Error(`${res.status}`);
          break;
        }
        const json = (await res.json()) as { elements?: El[] };
        return json.elements || [];
      } catch (e) {
        last = e;
        await sleep(2000);
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last));
}

function toLoc(el: El, brand: Brand): Location | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const tags = el.tags || {};
  const house = tags["addr:housenumber"] || "";
  const street = tags["addr:street"] || "";
  return {
    id: `osm-${brand.slug}-${el.type[0]}${el.id}`,
    retailerId: brand.retailerId,
    name: tags.name || tags.brand || brand.label,
    type: "store",
    lat,
    lng,
    address: tags["addr:full"] || [house, street].filter(Boolean).join(" ") || "Address unavailable",
    city: tags["addr:city"] || "",
    state: tags["addr:state"] || "",
    zip: tags["addr:postcode"] || "",
    externalId: `osm-${el.type}-${el.id}`,
  };
}

async function atomicWrite(file: string, data: string) {
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, file);
}

async function loadExisting(): Promise<Map<string, Location>> {
  const map = new Map<string, Location>();
  try {
    const store = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as AppStore;
    for (const l of store.locations) map.set(l.id, l);
  } catch {
    // empty
  }
  return map;
}

async function save(into: Map<string, Location>) {
  // Dedup by retailer+rounded coords
  const final = new Map<string, Location>();
  for (const loc of into.values()) {
    const key = `${loc.retailerId}:${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
    if (!final.has(key)) final.set(key, loc);
  }
  const locations = [...final.values()];
  const byRetailer: Record<string, number> = {};
  for (const loc of locations) {
    const n = RETAILERS.find((r) => r.id === loc.retailerId)?.name || loc.retailerId;
    byRetailer[n] = (byRetailer[n] || 0) + 1;
  }

  await atomicWrite(
    LOCATIONS_PATH,
    JSON.stringify({ importedAt: new Date().toISOString(), count: locations.length, byRetailer, locations }),
  );

  let store: AppStore;
  try {
    store = JSON.parse(await fs.readFile(STORE_PATH, "utf8")) as AppStore;
  } catch {
    const { createEmptyStore } = await import("../src/lib/seed");
    store = createEmptyStore();
  }
  store.retailers = RETAILERS;
  store.locations = locations;
  await atomicWrite(STORE_PATH, JSON.stringify(store));
  console.log("  saved", locations.length, byRetailer);
}

async function main() {
  const into = await loadExisting();
  console.log(`Starting with ${into.size} locations`);

  for (const brand of BRANDS) {
    console.log(`\n=== ${brand.label} (${GRID.length} cells) ===`);
    let brandAdded = 0;
    for (let i = 0; i < GRID.length; i++) {
      const [s, w, n, e] = GRID[i];
      const union = brand.filters.map((f) => `nwr${f}(${s},${w},${n},${e});`).join("\n");
      const q = `[out:json][timeout:75];(${union});out center tags;`;
      try {
        const els = await overpass(q);
        let added = 0;
        for (const el of els) {
          const loc = toLoc(el, brand);
          if (!loc || into.has(loc.id)) continue;
          into.set(loc.id, loc);
          added += 1;
          brandAdded += 1;
        }
        console.log(
          `  cell ${i + 1}/${GRID.length} [${s},${w}]: +${added} (brand ${brandAdded}, total ${into.size})`,
        );
      } catch (err) {
        console.warn(`  cell ${i + 1} failed:`, err);
      }
      await sleep(900);
      // checkpoint every 5 cells
      if ((i + 1) % 5 === 0) await save(into);
    }
    await save(into);
  }

  console.log("\nOSM top-up complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
