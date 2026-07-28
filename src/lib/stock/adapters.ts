import type { RetailerSlug, StockSnapshot, StockStatus, TrackedProduct } from "../types";

export interface PollResult {
  retailerSlug: RetailerSlug;
  productId: string;
  status: StockStatus;
  quantity: number | null;
  note?: string;
  ok: boolean;
}

const UA =
  "PokeStatsBot/1.0 (+https://github.com/cliclye/pokestats; respectful stock availability checks)";

async function fetchText(
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(14000),
      redirect: "follow",
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    return { ok: false, status: 0, text: String(err) };
  }
}

function inferFromHtml(html: string): StockStatus {
  const lower = html.toLowerCase();
  if (
    lower.includes("out of stock") ||
    lower.includes("sold out") ||
    lower.includes("currently unavailable") ||
    lower.includes('"availability":"outofstock"') ||
    lower.includes('"availability":"https://schema.org/outofstock"') ||
    lower.includes("not available") ||
    lower.includes("we don't know when or if this item will be back")
  ) {
    return "out";
  }
  if (
    lower.includes("add to cart") ||
    lower.includes("add to bag") ||
    lower.includes('"availability":"instock"') ||
    lower.includes('"availability":"https://schema.org/instock"') ||
    lower.includes("in stock") ||
    lower.includes("ship it") ||
    lower.includes("ships to")
  ) {
    return "in_stock";
  }
  if (lower.includes("limited") || lower.includes("only a few left") || lower.includes("preorder") || lower.includes("pre-order")) {
    return "limited";
  }
  return "unknown";
}

/** Target Redsky-style product lookup used by target.com storefront */
export async function pollTarget(product: TrackedProduct): Promise<PollResult> {
  const tcin = product.retailerSkus.target;
  if (!tcin) {
    return {
      retailerSlug: "target",
      productId: product.id,
      status: "unknown",
      quantity: null,
      ok: false,
      note: product.retailerUrls.target ? "no_sku" : "no sku",
    };
  }
  const url = `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_v1?key=ff457966e64d5e877fdbad070f276d18ecec4a01&tcin=${tcin}&store_id=3991&zip=10001`;
  const res = await fetchText(url);
  if (!res.ok) {
    // Target HTML shells are unreliable (false "in stock" from SPA chrome).
    // Prefer unknown over wrong links / status.
    return {
      retailerSlug: "target",
      productId: product.id,
      status: "unknown",
      quantity: null,
      ok: false,
      note: `api_blocked:${res.status}`,
    };
  }
  try {
    const data = JSON.parse(res.text) as {
      data?: {
        product?: {
          fulfillment?: {
            shipping_options?: { availability_status?: string };
            store_options?: Array<{ order_pickup?: { availability_status?: string } }>;
          };
        };
      };
    };
    const ship = data.data?.product?.fulfillment?.shipping_options?.availability_status;
    const pickup = data.data?.product?.fulfillment?.store_options?.[0]?.order_pickup?.availability_status;
    const raw = (ship || pickup || "").toUpperCase();
    let status: StockStatus = "unknown";
    if (raw.includes("IN_STOCK") || raw === "AVAILABLE") status = "in_stock";
    else if (raw.includes("OUT") || raw.includes("UNAVAILABLE")) status = "out";
    else if (raw.includes("LIMITED")) status = "limited";

    return { retailerSlug: "target", productId: product.id, status, quantity: null, ok: true, note: raw || "parsed" };
  } catch {
    return { retailerSlug: "target", productId: product.id, status: "unknown", quantity: null, ok: false, note: "parse_error" };
  }
}

export async function pollWalmart(product: TrackedProduct): Promise<PollResult> {
  const url = product.retailerUrls.walmart;
  if (!url) {
    return { retailerSlug: "walmart", productId: product.id, status: "unknown", quantity: null, ok: false, note: "no url" };
  }
  // Search pages are not reliable stock signals
  if (/\/search\?/i.test(url)) {
    return { retailerSlug: "walmart", productId: product.id, status: "unknown", quantity: null, ok: false, note: "search_url" };
  }
  const res = await fetchText(url);
  if (!res.ok) {
    return {
      retailerSlug: "walmart",
      productId: product.id,
      status: "unknown",
      quantity: null,
      ok: false,
      note: `blocked:${res.status}`,
    };
  }
  const status = inferFromHtml(res.text);
  // Require strong out/in markers; otherwise unknown
  return {
    retailerSlug: "walmart",
    productId: product.id,
    status,
    quantity: null,
    ok: true,
    note: status === "unknown" ? "ambiguous_html" : "html",
  };
}

export async function pollPokemonCenter(product: TrackedProduct): Promise<PollResult> {
  const url = product.retailerUrls["pokemon-center"];
  if (!url || /\/search\/|\/category\//i.test(url)) {
    return {
      retailerSlug: "pokemon-center",
      productId: product.id,
      status: "unknown",
      quantity: null,
      ok: false,
      note: url ? "search_url" : "no url",
    };
  }
  const res = await fetchText(url);
  return {
    retailerSlug: "pokemon-center",
    productId: product.id,
    status: res.ok ? inferFromHtml(res.text) : "unknown",
    quantity: null,
    ok: res.ok,
    note: res.ok ? "html" : `blocked:${res.status}`,
  };
}

export async function pollBestBuy(product: TrackedProduct): Promise<PollResult> {
  const pageUrl = product.retailerUrls["best-buy"];
  if (!pageUrl || /searchpage\.jsp/i.test(pageUrl)) {
    return {
      retailerSlug: "best-buy",
      productId: product.id,
      status: "unknown",
      quantity: null,
      ok: false,
      note: pageUrl ? "search_url" : "no url",
    };
  }
  const res = await fetchText(pageUrl);
  return {
    retailerSlug: "best-buy",
    productId: product.id,
    status: res.ok ? inferFromHtml(res.text) : "unknown",
    quantity: null,
    ok: res.ok,
    note: res.ok ? "html" : `blocked:${res.status}`,
  };
}

export async function pollGameStop(product: TrackedProduct): Promise<PollResult> {
  const url = product.retailerUrls.gamestop;
  if (!url || /\/search\/?/i.test(url)) {
    return {
      retailerSlug: "gamestop",
      productId: product.id,
      status: "unknown",
      quantity: null,
      ok: false,
      note: url ? "search_url" : "no url",
    };
  }
  const res = await fetchText(url);
  return {
    retailerSlug: "gamestop",
    productId: product.id,
    status: res.ok ? inferFromHtml(res.text) : "unknown",
    quantity: null,
    ok: res.ok,
    note: res.ok ? "html" : `blocked:${res.status}`,
  };
}

export async function pollAmazon(product: TrackedProduct): Promise<PollResult> {
  const url = product.retailerUrls.amazon;
  if (!url || /\/s\?/i.test(url)) {
    return {
      retailerSlug: "amazon",
      productId: product.id,
      status: "unknown",
      quantity: null,
      ok: false,
      note: url ? "search_url" : "no url",
    };
  }
  const res = await fetchText(url);
  return {
    retailerSlug: "amazon",
    productId: product.id,
    status: res.ok ? inferFromHtml(res.text) : "unknown",
    quantity: null,
    ok: res.ok,
    note: res.ok ? "html" : `blocked:${res.status}`,
  };
}

const ADAPTERS: Partial<Record<RetailerSlug, (p: TrackedProduct) => Promise<PollResult>>> = {
  target: pollTarget,
  walmart: pollWalmart,
  "pokemon-center": pollPokemonCenter,
  "best-buy": pollBestBuy,
  gamestop: pollGameStop,
  // Amazon omitted — 3P marketplace pricing is often far above MSRP
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

export async function pollAllProducts(
  products: TrackedProduct[],
  delayMs = 800,
): Promise<PollResult[]> {
  const tasks: Array<{ product: TrackedProduct; slug: RetailerSlug }> = [];
  for (const product of products) {
    for (const slug of Object.keys(ADAPTERS) as RetailerSlug[]) {
      if (!ADAPTERS[slug]) continue;
      if (!product.retailerSkus[slug] && !product.retailerUrls[slug]) continue;
      tasks.push({ product, slug });
    }
  }

  return mapPool(tasks, 3, async ({ product, slug }) => {
    const adapter = ADAPTERS[slug]!;
    const result = await adapter(product);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return result;
  });
}

export function resultsToSnapshots(
  results: PollResult[],
  retailerIdBySlug: Map<string, string>,
  onlineLocationIdByRetailer: Map<string, string>,
): StockSnapshot[] {
  const now = new Date().toISOString();
  return results.map((r) => {
    const retailerId = retailerIdBySlug.get(r.retailerSlug) || "";
    const locationId = onlineLocationIdByRetailer.get(retailerId) ?? null;
    return {
      // Stable id so repeated polls upsert instead of duplicating
      id: `snap-online-${r.retailerSlug}-${r.productId}`,
      locationId,
      productId: r.productId,
      retailerId,
      status: r.status,
      quantity: r.quantity,
      source: "online_poll" as const,
      checkedAt: now,
      note: r.note,
    };
  });
}
