#!/usr/bin/env tsx
/**
 * Nationwide location importer — free sources only.
 *
 * 1) AllThePlaces Target US GeoJSON
 * 2) OpenStreetMap Overpass by US state (Walmart, Target, Best Buy, GameStop, Sam's Club, Pokémon Center)
 * 3) Public Pokémon vending GeoJSON (~1.6k)
 *
 * Usage: npm run import:locations
 */
import { promises as fs } from "fs";
import path from "path";
import { RETAILERS } from "../src/lib/seed";
import type { AppStore, Location, RetailerSlug } from "../src/lib/types";

const STORE_PATH = path.join(process.cwd(), "data", "store.json");
const LOCATIONS_PATH = path.join(process.cwd(), "data", "locations.json");

const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const ATP_TARGET =
  "https://data.alltheplaces.xyz/runs/latest/output/target_us.geojson";

const VENDING_URL =
  "https://joxufhbfpzfhaaudznor.supabase.co/storage/v1/object/public/vending-data/pokemon_vending_locations_20251213_035517.geojson";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

interface OverpassElement {
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

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "PokeStats/1.0", Accept: "application/json,application/geo+json" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json();
}

async function overpass(query: string): Promise<OverpassElement[]> {
  let lastErr: unknown;
  for (const url of OVERPASS_URLS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json",
            "User-Agent": "PokeStats/1.0 (OSM state import)",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(150_000),
        });
        if (res.status === 429 || res.status === 504 || res.status >= 500) {
          await sleep(5000 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = new Error(`${url} ${res.status}`);
          break;
        }
        const json = (await res.json()) as { elements?: OverpassElement[] };
        return json.elements || [];
      } catch (err) {
        lastErr = err;
        await sleep(3000 * (attempt + 1));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function classify(tags: Record<string, string>): { slug: RetailerSlug; retailerId: string; label: string } | null {
  const wiki = tags["brand:wikidata"] || "";
  const brand = (tags.brand || "").toLowerCase();
  const name = (tags.name || "").toLowerCase();

  if (wiki === "Q504614" || brand === "target" || name === "target") {
    return { slug: "target", retailerId: "r-target", label: "Target" };
  }
  if (wiki === "Q1970340" || brand.includes("sam") && brand.includes("club") || name.includes("sam's club")) {
    return { slug: "walmart", retailerId: "r-walmart", label: "Sam's Club" };
  }
  if (wiki === "Q483551" || brand === "walmart" || name.startsWith("walmart")) {
    return { slug: "walmart", retailerId: "r-walmart", label: "Walmart" };
  }
  if (wiki === "Q533415" || brand === "best buy" || name === "best buy") {
    return { slug: "best-buy", retailerId: "r-best-buy", label: "Best Buy" };
  }
  if (wiki === "Q696140" || brand === "gamestop" || name === "gamestop") {
    return { slug: "gamestop", retailerId: "r-gamestop", label: "GameStop" };
  }
  if (name.includes("pokemon center") || name.includes("pokémon center") || brand.includes("pokemon center")) {
    return { slug: "pokemon-center", retailerId: "r-pokemon-center", label: "Pokémon Center" };
  }
  return null;
}

function osmToLocation(el: OverpassElement): Location | null {
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  const tags = el.tags || {};
  const meta = classify(tags);
  if (!meta) return null;
  const house = tags["addr:housenumber"] || "";
  const street = tags["addr:street"] || "";
  return {
    id: `osm-${meta.slug}-${el.type[0]}${el.id}`,
    retailerId: meta.retailerId,
    name: tags.name || tags.brand || meta.label,
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

function stateQuery(state: string) {
  return `
[out:json][timeout:120];
area["ISO3166-2"="US-${state}"][admin_level=4]->.s;
(
  nwr["brand"="Target"](area.s);
  nwr["brand:wikidata"="Q504614"](area.s);
  nwr["name"="Target"](area.s);
  nwr["brand"="Walmart"](area.s);
  nwr["brand:wikidata"="Q483551"](area.s);
  nwr["name"~"^Walmart",i](area.s);
  nwr["brand"="Sam's Club"](area.s);
  nwr["brand:wikidata"="Q1970340"](area.s);
  nwr["brand"="Best Buy"](area.s);
  nwr["brand:wikidata"="Q533415"](area.s);
  nwr["name"="Best Buy"](area.s);
  nwr["brand"="GameStop"](area.s);
  nwr["brand:wikidata"="Q696140"](area.s);
  nwr["name"="GameStop"](area.s);
  nwr["name"~"Pokémon Center|Pokemon Center",i](area.s);
);
out center tags;
`.trim();
}

async function importAtpTarget(into: Map<string, Location>) {
  console.log("Downloading AllThePlaces Target US…");
  const geo = (await fetchJson(ATP_TARGET)) as {
    features: Array<{
      geometry: { coordinates: [number, number] };
      properties: Record<string, string>;
    }>;
  };
  let added = 0;
  for (const f of geo.features) {
    const [lng, lat] = f.geometry.coordinates;
    if (lat == null || lng == null) continue;
    const p = f.properties;
    const ref = p.ref || `${lat},${lng}`;
    const id = `atp-target-${ref}`;
    if (into.has(id)) continue;
    into.set(id, {
      id,
      retailerId: "r-target",
      name: p.name || p.branch || "Target",
      type: "store",
      lat,
      lng,
      address: p["addr:street_address"] || p["addr:full"] || "",
      city: p["addr:city"] || "",
      state: p["addr:state"] || "",
      zip: p["addr:postcode"] || "",
      externalId: `atp-target-${ref}`,
    });
    added += 1;
  }
  console.log(`  Target ATP: +${added}`);
}

async function importOverpassStates(into: Map<string, Location>) {
  console.log(`OpenStreetMap Overpass by state (${US_STATES.length})…`);
  for (let i = 0; i < US_STATES.length; i++) {
    const state = US_STATES[i];
    try {
      const elements = await overpass(stateQuery(state));
      let added = 0;
      for (const el of elements) {
        const loc = osmToLocation(el);
        if (!loc?.externalId) continue;
        // Prefer ATP Target ids if same rounded coords exist — still keep OSM if new
        if (!into.has(loc.id)) {
          into.set(loc.id, { ...loc, state: loc.state || state });
          added += 1;
        }
      }
      console.log(`  ${state}: +${added} (total ${into.size}) [${i + 1}/${US_STATES.length}]`);
    } catch (err) {
      console.warn(`  ${state} failed:`, err);
    }
    await sleep(1100);
  }
}

async function importVending(into: Map<string, Location>) {
  console.log("Downloading Pokémon vending machines…");
  const geo = (await fetchJson(VENDING_URL)) as {
    features: Array<{
      geometry: { coordinates: [number, number] };
      properties: Record<string, string>;
    }>;
  };
  let added = 0;
  for (const f of geo.features) {
    const [lng, lat] = f.geometry.coordinates;
    const p = f.properties;
    const id = `vend-${p.id || p.machine_id}`;
    if (into.has(id)) continue;
    into.set(id, {
      id,
      retailerId: "r-vending",
      name: `Pokémon Vending — ${p.retailer || "Store"}`,
      type: "vending",
      lat,
      lng,
      address: p.address || p.full_address || p.address_full || "",
      city: p.city || "",
      state: p.state || "",
      zip: p.zip || "",
      externalId: p.machine_id || p.id,
    });
    added += 1;
  }
  console.log(`  Vending: +${added}`);
}

function onlinePins(): Location[] {
  return [
    { id: "online-pc", retailerId: "r-pokemon-center", name: "Pokémon Center Online", type: "online", lat: 47.6062, lng: -122.3321, address: "Online", city: "Bellevue", state: "WA", zip: "98004", externalId: "pc-online" },
    { id: "online-target", retailerId: "r-target", name: "Target.com Online", type: "online", lat: 44.9742, lng: -93.2773, address: "Online", city: "Minneapolis", state: "MN", zip: "55402", externalId: "t-online" },
    { id: "online-walmart", retailerId: "r-walmart", name: "Walmart.com Online", type: "online", lat: 36.3729, lng: -94.2088, address: "Online", city: "Bentonville", state: "AR", zip: "72712", externalId: "w-online" },
    { id: "online-bestbuy", retailerId: "r-best-buy", name: "BestBuy.com Online", type: "online", lat: 44.8625, lng: -93.2914, address: "Online", city: "Richfield", state: "MN", zip: "55423", externalId: "bb-online" },
    { id: "online-gamestop", retailerId: "r-gamestop", name: "GameStop.com Online", type: "online", lat: 32.9483, lng: -96.7297, address: "Online", city: "Grapevine", state: "TX", zip: "76051", externalId: "gs-online" },
  ];
}

async function persist(locations: Location[]) {
  const byRetailer: Record<string, number> = {};
  for (const loc of locations) {
    const name = RETAILERS.find((r) => r.id === loc.retailerId)?.name || loc.retailerId;
    byRetailer[name] = (byRetailer[name] || 0) + 1;
  }

  await fs.mkdir(path.dirname(LOCATIONS_PATH), { recursive: true });
  await fs.writeFile(
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
  const ids = new Set(locations.map((l) => l.id));
  store.snapshots = (store.snapshots || []).filter((s) => !s.locationId || ids.has(s.locationId));
  store.reports = (store.reports || []).filter((r) => ids.has(r.locationId));

  const tmp = `${STORE_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(store));
  await fs.rename(tmp, STORE_PATH);

  console.log("\nSaved:");
  console.log(byRetailer);
  console.log(`Total: ${locations.length}`);
}

async function main() {
  const into = new Map<string, Location>();
  for (const pin of onlinePins()) into.set(pin.id, pin);

  // Fast wins first so the map has thousands ASAP
  await importVending(into);
  await importAtpTarget(into);
  await persist([...into.values()]);
  console.log("Checkpoint saved (vending + Target). Continuing OSM for remaining chains…\n");

  await importOverpassStates(into);

  // Dedup near-identical coordinates per retailer
  const final = new Map<string, Location>();
  for (const loc of into.values()) {
    const key = `${loc.retailerId}:${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
    if (!final.has(key)) final.set(key, loc);
  }

  await persist([...final.values()]);
  console.log("Import complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
