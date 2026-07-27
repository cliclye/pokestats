import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEmptyStore, PRODUCTS, RETAILERS } from "./seed";
import { looksLikeSealedProduct } from "./stock/product-taxonomy";
import type {
  AppStore,
  Card,
  CardSet,
  Location,
  Retailer,
  StockReport,
  StockSnapshot,
  TrackedProduct,
  WebStockSignal,
} from "./types";

function isImportableSignalName(name: string) {
  return looksLikeSealedProduct(name);
}

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const LOCATIONS_PATH = path.join(DATA_DIR, "locations.json");

function hasSupabase() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

function jobsSecret() {
  return process.env.JOBS_SECRET || "";
}

function canWriteRemote() {
  return Boolean(
    hasSupabase() && (process.env.SUPABASE_SERVICE_ROLE_KEY || jobsSecret()),
  );
}

function getSupabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}

async function atomicWrite(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, contents);
  await fs.rename(tmp, filePath);
}

async function readJsonFile<T>(filePath: string, attempts = 5): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      await new Promise((r) => setTimeout(r, 50 * (i + 1)));
    }
  }
  return null;
}

async function ensureLocalStore(): Promise<AppStore> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const parsed = await readJsonFile<AppStore>(STORE_PATH);
  if (parsed?.locations && parsed.retailers) {
    if (!parsed.webSignals) parsed.webSignals = [];
    if (!parsed.meta) {
      parsed.meta = {
        pricesSyncedAt: null,
        stockPolledAt: null,
        webSignalsSyncedAt: null,
      };
    } else if (parsed.meta.webSignalsSyncedAt === undefined) {
      parsed.meta.webSignalsSyncedAt = null;
    }
    const locFile = await readJsonFile<{ locations: AppStore["locations"] }>(LOCATIONS_PATH);
    if (
      locFile?.locations &&
      locFile.locations.length > (parsed.locations?.length || 0) + 50
    ) {
      parsed.locations = locFile.locations;
    }
    return parsed;
  }

  const locFile = await readJsonFile<{ locations: AppStore["locations"] }>(LOCATIONS_PATH);
  const store = createEmptyStore();
  if (locFile?.locations?.length) {
    store.locations = locFile.locations;
  }
  await atomicWrite(STORE_PATH, JSON.stringify(store));
  return store;
}

async function writeLocalStore(store: AppStore) {
  await atomicWrite(STORE_PATH, JSON.stringify(store));
}

function mapRetailer(row: Record<string, unknown>): Retailer {
  return {
    id: String(row.id),
    slug: row.slug as Retailer["slug"],
    name: String(row.name),
    color: String(row.color),
  };
}

function mapLocation(row: Record<string, unknown>): Location {
  return {
    id: String(row.id),
    retailerId: String(row.retailer_id),
    name: String(row.name),
    type: row.type as Location["type"],
    lat: Number(row.lat),
    lng: Number(row.lng),
    address: String(row.address),
    city: String(row.city),
    state: String(row.state),
    zip: String(row.zip),
    externalId: row.external_id ? String(row.external_id) : undefined,
  };
}

function mapProduct(row: Record<string, unknown>): TrackedProduct {
  return {
    id: String(row.id),
    name: String(row.name),
    setCode: String(row.set_code),
    category: row.category as TrackedProduct["category"],
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    retailerSkus: (row.retailer_skus as TrackedProduct["retailerSkus"]) || {},
    retailerUrls: (row.retailer_urls as TrackedProduct["retailerUrls"]) || {},
  };
}

function mapSnapshot(row: Record<string, unknown>): StockSnapshot {
  return {
    id: String(row.id),
    locationId: row.location_id ? String(row.location_id) : null,
    productId: String(row.product_id),
    retailerId: String(row.retailer_id),
    status: row.status as StockSnapshot["status"],
    quantity: row.quantity == null ? null : Number(row.quantity),
    source: row.source as StockSnapshot["source"],
    checkedAt: String(row.checked_at),
    note: row.note ? String(row.note) : undefined,
  };
}

function mapReport(row: Record<string, unknown>): StockReport {
  return {
    id: String(row.id),
    locationId: String(row.location_id),
    productId: row.product_id ? String(row.product_id) : null,
    status: row.status as StockReport["status"],
    note: String(row.note || ""),
    reporterLabel: String(row.reporter_label || "Anonymous"),
    createdAt: String(row.created_at),
  };
}

function mapSignal(row: Record<string, unknown>): WebStockSignal {
  return {
    id: String(row.id),
    sourceSite: String(row.source_site),
    title: String(row.title),
    url: row.url ? String(row.url) : null,
    retailerSlug: (row.retailer_slug as WebStockSignal["retailerSlug"]) || null,
    productId: row.product_id ? String(row.product_id) : null,
    productName: String(row.product_name),
    status: row.status as WebStockSignal["status"],
    observedAt: String(row.observed_at),
    raw: String(row.raw || ""),
  };
}

function mapSet(row: Record<string, unknown>): CardSet {
  return {
    id: String(row.id),
    name: String(row.name),
    series: String(row.series),
    releaseDate: String(row.release_date),
    total: Number(row.total),
    printedTotal: Number(row.printed_total),
    imageSymbol: row.image_symbol ? String(row.image_symbol) : undefined,
    imageLogo: row.image_logo ? String(row.image_logo) : undefined,
  };
}

function mapCard(row: Record<string, unknown>): Card {
  return {
    id: String(row.id),
    name: String(row.name),
    number: String(row.number),
    rarity: row.rarity == null ? null : String(row.rarity),
    setId: String(row.set_id),
    setName: String(row.set_name),
    artist: row.artist == null ? null : String(row.artist),
    imageSmall: row.image_small == null ? null : String(row.image_small),
    imageLarge: row.image_large == null ? null : String(row.image_large),
    tcgplayerUrl: row.tcgplayer_url == null ? null : String(row.tcgplayer_url),
    prices: (row.prices as Card["prices"]) || {},
    priceUpdatedAt: row.price_updated_at ? String(row.price_updated_at) : null,
  };
}

async function fetchAllRows(
  supabase: SupabaseClient,
  table: string,
  select = "*",
  pageSize = 1000,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(select).range(from, to);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function readSupabaseStore(supabase: SupabaseClient): Promise<AppStore | null> {
  try {
    const [
      retailers,
      locations,
      products,
      snapshots,
      reports,
      webSignals,
      sets,
      cards,
      metaRows,
    ] = await Promise.all([
      fetchAllRows(supabase, "retailers"),
      fetchAllRows(supabase, "locations"),
      fetchAllRows(supabase, "products"),
      fetchAllRows(supabase, "stock_snapshots"),
      fetchAllRows(supabase, "stock_reports"),
      fetchAllRows(supabase, "web_signals"),
      fetchAllRows(supabase, "card_sets"),
      fetchAllRows(supabase, "cards"),
      supabase.from("app_meta").select("*"),
    ]);

    if (!retailers.length && !locations.length) return null;

    const metaMap = new Map(
      ((metaRows.data as { key: string; value: unknown }[] | null) || []).map((r) => [
        r.key,
        r.value,
      ]),
    );

    return {
      retailers: retailers.map(mapRetailer),
      locations: locations.map(mapLocation),
      products: products.length ? products.map(mapProduct) : PRODUCTS,
      snapshots: snapshots.map(mapSnapshot),
      reports: reports.map(mapReport),
      webSignals: webSignals.map(mapSignal),
      sets: sets.map(mapSet),
      cards: cards.map(mapCard),
      meta: {
        pricesSyncedAt: (metaMap.get("pricesSyncedAt") as string | null) ?? null,
        stockPolledAt: (metaMap.get("stockPolledAt") as string | null) ?? null,
        webSignalsSyncedAt: (metaMap.get("webSignalsSyncedAt") as string | null) ?? null,
      },
    };
  } catch (err) {
    console.error("supabase readStore failed", err);
    return null;
  }
}

async function setMeta(supabase: SupabaseClient, key: string, value: string | null) {
  await upsertChunked(supabase, "app_meta", [{ key, value }]);
}

async function upsertChunked(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  chunkSize = 400,
) {
  const secret = jobsSecret();
  const useRpc = !process.env.SUPABASE_SERVICE_ROLE_KEY && Boolean(secret);

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (useRpc) {
      const { error } = await supabase.rpc("job_upsert_json", {
        p_secret: secret,
        p_table: table,
        p_rows: chunk,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from(table).upsert(chunk);
      if (error) throw error;
    }
  }
}

async function ensureAmazonOnline(supabase: SupabaseClient) {
  await upsertChunked(supabase, "retailers", [
    {
      id: "r-amazon",
      slug: "amazon",
      name: "Amazon",
      color: "#FF9900",
    },
  ]);
  await upsertChunked(supabase, "locations", [
    {
      id: "online-amazon",
      retailer_id: "r-amazon",
      name: "Amazon.com Online",
      type: "online",
      lat: 47.6225,
      lng: -122.337,
      address: "Online",
      city: "Seattle",
      state: "WA",
      zip: "98109",
      external_id: "amz-online",
    },
  ]);
}

export async function readStore(): Promise<AppStore> {
  const supabase = getSupabase();
  if (supabase) {
    const remote = await readSupabaseStore(supabase);
    if (remote) return remote;
  }
  return ensureLocalStore();
}

export async function updateStore(
  mutator: (store: AppStore) => void | Promise<void>,
): Promise<AppStore> {
  // Local JSON path only — remote writes go through dedicated upsert helpers.
  if (canWriteRemote()) {
    const store = await readStore();
    await mutator(store);
    return store;
  }
  const store = await ensureLocalStore();
  await mutator(store);
  await writeLocalStore(store);
  return store;
}

export async function upsertSnapshots(snapshots: StockSnapshot[]) {
  const supabase = getSupabase();
  if (supabase && canWriteRemote()) {
    await upsertChunked(
      supabase,
      "stock_snapshots",
      snapshots.map((s) => ({
        id: s.id,
        location_id: s.locationId,
        product_id: s.productId,
        retailer_id: s.retailerId,
        status: s.status,
        quantity: s.quantity,
        source: s.source,
        checked_at: s.checkedAt,
        note: s.note ?? null,
      })),
    );
    await setMeta(supabase, "stockPolledAt", new Date().toISOString());
    return readStore();
  }

  return updateStore((store) => {
    for (const snap of snapshots) {
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
    store.meta.stockPolledAt = new Date().toISOString();
  });
}

export async function addReport(report: StockReport) {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from("stock_reports").insert({
      id: report.id,
      location_id: report.locationId,
      product_id: report.productId,
      status: report.status,
      note: report.note,
      reporter_label: report.reporterLabel,
      created_at: report.createdAt,
    });
    if (error) throw error;
    return readStore();
  }

  return updateStore((store) => {
    store.reports.unshift(report);
    store.reports = store.reports.slice(0, 500);
  });
}

export async function upsertWebSignals(
  signals: WebStockSignal[],
  snapshots: StockSnapshot[] = [],
) {
  const supabase = getSupabase();
  if (supabase && canWriteRemote()) {
    await ensureAmazonOnline(supabase);
    try {
      await supabase.rpc("job_cleanup_web_signals", {
        p_secret: jobsSecret(),
      });
    } catch {
      // cleanup is best-effort
    }

    await upsertChunked(
      supabase,
      "web_signals",
      signals
        .filter((s) => isImportableSignalName(s.productName))
        .map((s) => ({
        id: s.id,
        source_site: s.sourceSite,
        title: s.title,
        url: s.url,
        retailer_slug: s.retailerSlug,
        product_id: s.productId,
        product_name: s.productName,
        status: s.status,
        observed_at: s.observedAt,
        raw: s.raw,
      })),
    );
    if (snapshots.length) {
      await upsertChunked(
        supabase,
        "stock_snapshots",
        snapshots.map((s) => ({
          id: s.id,
          location_id: s.locationId,
          product_id: s.productId,
          retailer_id: s.retailerId,
          status: s.status,
          quantity: s.quantity,
          source: s.source,
          checked_at: s.checkedAt,
          note: s.note ?? null,
        })),
      );
      await setMeta(supabase, "stockPolledAt", new Date().toISOString());
    }
    await setMeta(supabase, "webSignalsSyncedAt", new Date().toISOString());
    return readStore();
  }

  return updateStore((store) => {
    if (!store.webSignals) store.webSignals = [];
    // Replace NowInStock rows entirely so junk/accessory listings don't linger
    const kept = store.webSignals.filter((s) => s.sourceSite !== "nowinstock.net");
    const incoming = signals.filter((s) => isImportableSignalName(s.productName));
    const byId = new Map(kept.map((s) => [s.id, s]));
    for (const s of incoming) byId.set(s.id, s);
    store.webSignals = [...byId.values()]
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
      .slice(0, 300);
    store.meta.webSignalsSyncedAt = new Date().toISOString();

    if (snapshots.length) {
      for (const snap of snapshots) {
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
      store.meta.stockPolledAt = new Date().toISOString();
    }

    if (!store.retailers.some((r) => r.slug === "amazon")) {
      store.retailers.push({
        id: "r-amazon",
        slug: "amazon",
        name: "Amazon",
        color: "#FF9900",
      });
    }
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
  });
}

export async function upsertSetsAndCards(sets: CardSet[], cards: Card[]) {
  const supabase = getSupabase();
  if (supabase && canWriteRemote()) {
    await upsertChunked(
      supabase,
      "card_sets",
      sets.map((s) => ({
        id: s.id,
        name: s.name,
        series: s.series,
        release_date: s.releaseDate,
        total: s.total,
        printed_total: s.printedTotal,
        image_symbol: s.imageSymbol ?? null,
        image_logo: s.imageLogo ?? null,
      })),
    );
    await upsertChunked(
      supabase,
      "cards",
      cards.map((c) => ({
        id: c.id,
        name: c.name,
        number: c.number,
        rarity: c.rarity,
        set_id: c.setId,
        set_name: c.setName,
        artist: c.artist,
        image_small: c.imageSmall,
        image_large: c.imageLarge,
        tcgplayer_url: c.tcgplayerUrl,
        prices: c.prices,
        price_updated_at: c.priceUpdatedAt,
      })),
    );
    await setMeta(supabase, "pricesSyncedAt", new Date().toISOString());
    return readStore();
  }

  return updateStore((store) => {
    const setMap = new Map(store.sets.map((s) => [s.id, s]));
    for (const s of sets) setMap.set(s.id, s);
    store.sets = Array.from(setMap.values()).sort((a, b) =>
      b.releaseDate.localeCompare(a.releaseDate),
    );

    const cardMap = new Map(store.cards.map((c) => [c.id, c]));
    for (const c of cards) cardMap.set(c.id, c);
    store.cards = Array.from(cardMap.values());
    store.meta.pricesSyncedAt = new Date().toISOString();
  });
}

/** Push a full AppStore into Supabase (seed / cutover). */
export async function pushStoreToSupabase(store: AppStore) {
  const supabase = getSupabase();
  if (!supabase || !canWriteRemote()) {
    throw new Error("Supabase URL + (SERVICE_ROLE_KEY or JOBS_SECRET) required to push store");
  }

  const retailers = store.retailers.length ? store.retailers : RETAILERS;
  await upsertChunked(
    supabase,
    "retailers",
    retailers.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      color: r.color,
    })),
  );

  await upsertChunked(
    supabase,
    "locations",
    store.locations.map((l) => ({
      id: l.id,
      retailer_id: l.retailerId,
      name: l.name,
      type: l.type,
      lat: l.lat,
      lng: l.lng,
      address: l.address,
      city: l.city,
      state: l.state,
      zip: l.zip,
      external_id: l.externalId ?? null,
    })),
  );

  await upsertChunked(
    supabase,
    "products",
    (store.products.length ? store.products : PRODUCTS).map((p) => ({
      id: p.id,
      name: p.name,
      set_code: p.setCode,
      category: p.category,
      image_url: p.imageUrl ?? null,
      retailer_skus: p.retailerSkus,
      retailer_urls: p.retailerUrls,
    })),
  );

  if (store.snapshots.length) {
    await upsertChunked(
      supabase,
      "stock_snapshots",
      store.snapshots.map((s) => ({
        id: s.id,
        location_id: s.locationId,
        product_id: s.productId,
        retailer_id: s.retailerId,
        status: s.status,
        quantity: s.quantity,
        source: s.source,
        checked_at: s.checkedAt,
        note: s.note ?? null,
      })),
    );
  }

  if (store.reports.length) {
    await upsertChunked(
      supabase,
      "stock_reports",
      store.reports.map((r) => ({
        id: r.id,
        location_id: r.locationId,
        product_id: r.productId,
        status: r.status,
        note: r.note,
        reporter_label: r.reporterLabel,
        created_at: r.createdAt,
      })),
    );
  }

  if (store.webSignals?.length) {
    await upsertChunked(
      supabase,
      "web_signals",
      store.webSignals.map((s) => ({
        id: s.id,
        source_site: s.sourceSite,
        title: s.title,
        url: s.url,
        retailer_slug: s.retailerSlug,
        product_id: s.productId,
        product_name: s.productName,
        status: s.status,
        observed_at: s.observedAt,
        raw: s.raw,
      })),
    );
  }

  if (store.sets.length) {
    await upsertChunked(
      supabase,
      "card_sets",
      store.sets.map((s) => ({
        id: s.id,
        name: s.name,
        series: s.series,
        release_date: s.releaseDate,
        total: s.total,
        printed_total: s.printedTotal,
        image_symbol: s.imageSymbol ?? null,
        image_logo: s.imageLogo ?? null,
      })),
    );
  }

  if (store.cards.length) {
    await upsertChunked(
      supabase,
      "cards",
      store.cards.map((c) => ({
        id: c.id,
        name: c.name,
        number: c.number,
        rarity: c.rarity,
        set_id: c.setId,
        set_name: c.setName,
        artist: c.artist,
        image_small: c.imageSmall,
        image_large: c.imageLarge,
        tcgplayer_url: c.tcgplayerUrl,
        prices: c.prices,
        price_updated_at: c.priceUpdatedAt,
      })),
    );
  }

  await upsertChunked(supabase, "app_meta", [
    { key: "pricesSyncedAt", value: store.meta.pricesSyncedAt },
    { key: "stockPolledAt", value: store.meta.stockPolledAt },
    { key: "webSignalsSyncedAt", value: store.meta.webSignalsSyncedAt },
  ]);
}

export function isUsingSupabase() {
  return hasSupabase();
}
