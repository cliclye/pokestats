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
  "PokeStatsBot/1.0 (+https://github.com/pokestats; respectful stock availability checks; contact via repo)";

async function fetchText(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
        ...(init?.headers || {}),
      },
      signal: AbortSignal.timeout(12000),
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
    lower.includes("not available")
  ) {
    return "out";
  }
  if (
    lower.includes("add to cart") ||
    lower.includes("add to bag") ||
    lower.includes('"availability":"instock"') ||
    lower.includes("in stock") ||
    lower.includes("ship it")
  ) {
    return "in_stock";
  }
  if (lower.includes("limited") || lower.includes("only a few left")) {
    return "limited";
  }
  return "unknown";
}

/** Target Redsky-style product lookup used by target.com storefront */
export async function pollTarget(product: TrackedProduct): Promise<PollResult> {
  const tcin = product.retailerSkus.target;
  if (!tcin) {
    return { retailerSlug: "target", productId: product.id, status: "unknown", quantity: null, ok: false, note: "no sku" };
  }
  const url = `https://redsky.target.com/redsky_aggregations/v1/web/product_fulfillment_v1?key=ff457966e64d5e877fdbad070f276d18ecec4a01&tcin=${tcin}&store_id=3991&zip=10001`;
  const res = await fetchText(url);
  if (!res.ok) {
    // Fall back to product page HTML signal
    const page = product.retailerUrls.target
      ? await fetchText(product.retailerUrls.target)
      : res;
    return {
      retailerSlug: "target",
      productId: product.id,
      status: page.ok ? inferFromHtml(page.text) : "unknown",
      quantity: null,
      ok: page.ok,
      note: page.ok ? "html_fallback" : `blocked:${res.status}`,
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

    if (status === "unknown" && product.retailerUrls.target) {
      const page = await fetchText(product.retailerUrls.target);
      if (page.ok) {
        const inferred = inferFromHtml(page.text);
        return {
          retailerSlug: "target",
          productId: product.id,
          status: inferred,
          quantity: null,
          ok: true,
          note: raw ? `${raw}+html` : "html_fallback",
        };
      }
    }

    return { retailerSlug: "target", productId: product.id, status, quantity: null, ok: true, note: raw || "parsed" };
  } catch {
    return { retailerSlug: "target", productId: product.id, status: "unknown", quantity: null, ok: false, note: "parse_error" };
  }
}

/** Walmart product page / runtime signals */
export async function pollWalmart(product: TrackedProduct): Promise<PollResult> {
  const url = product.retailerUrls.walmart;
  if (!url) {
    return { retailerSlug: "walmart", productId: product.id, status: "unknown", quantity: null, ok: false, note: "no url" };
  }
  const res = await fetchText(url);
  return {
    retailerSlug: "walmart",
    productId: product.id,
    status: res.ok ? inferFromHtml(res.text) : "unknown",
    quantity: null,
    ok: res.ok,
    note: res.ok ? "html" : `blocked:${res.status}`,
  };
}

export async function pollPokemonCenter(product: TrackedProduct): Promise<PollResult> {
  const url = product.retailerUrls["pokemon-center"];
  if (!url) {
    return { retailerSlug: "pokemon-center", productId: product.id, status: "unknown", quantity: null, ok: false, note: "no url" };
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
  const sku = product.retailerSkus["best-buy"];
  if (!sku) {
    return { retailerSlug: "best-buy", productId: product.id, status: "unknown", quantity: null, ok: false, note: "no sku" };
  }
  // Public availability endpoint used by Best Buy product pages
  const url = `https://www.bestbuy.com/gateway/graphql`;
  // Prefer product page HTML when GraphQL requires complex auth cookies
  const pageUrl = product.retailerUrls["best-buy"];
  if (!pageUrl) {
    return { retailerSlug: "best-buy", productId: product.id, status: "unknown", quantity: null, ok: false, note: "no url" };
  }
  void url;
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
  if (!url) {
    return { retailerSlug: "gamestop", productId: product.id, status: "unknown", quantity: null, ok: false, note: "no url" };
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

const ADAPTERS: Record<
  Exclude<RetailerSlug, "vending" | "amazon">,
  (p: TrackedProduct) => Promise<PollResult>
> = {
  target: pollTarget,
  walmart: pollWalmart,
  "pokemon-center": pollPokemonCenter,
  "best-buy": pollBestBuy,
  gamestop: pollGameStop,
};

export async function pollAllProducts(
  products: TrackedProduct[],
  delayMs = 1500,
): Promise<PollResult[]> {
  const results: PollResult[] = [];
  for (const product of products) {
    for (const [slug, adapter] of Object.entries(ADAPTERS) as Array<
      [Exclude<RetailerSlug, "vending" | "amazon">, (p: TrackedProduct) => Promise<PollResult>]
    >) {
      if (!product.retailerSkus[slug] && !product.retailerUrls[slug]) continue;
      const result = await adapter(product);
      results.push(result);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

export function resultsToSnapshots(
  results: PollResult[],
  retailerIdBySlug: Map<string, string>,
  onlineLocationIdByRetailer: Map<string, string>,
): StockSnapshot[] {
  const now = new Date().toISOString();
  return results.map((r, i) => {
    const retailerId = retailerIdBySlug.get(r.retailerSlug) || "";
    return {
      id: `snap-${Date.now()}-${i}`,
      locationId: onlineLocationIdByRetailer.get(retailerId) ?? null,
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
