/**
 * Public web stock/restock signal scrapers.
 * Sources: NowInStock (live retailer availability pages), PullPush Reddit archive (best-effort).
 * Polite User-Agent, no CAPTCHA bypass, fail soft.
 */
import type {
  Location,
  RetailerSlug,
  StockSnapshot,
  StockStatus,
  TrackedProduct,
  WebStockSignal,
} from "../types";

const UA =
  "PokeStatsBot/1.0 (+local; respectful public stock/page checks)";

const NOWINSTOCK_URL =
  "https://www.nowinstock.net/collectibles/tradingcards/pokemoncards/";

const RETAILER_ALIASES: Array<{ match: RegExp; slug: RetailerSlug }> = [
  { match: /\btarget\b/i, slug: "target" },
  { match: /\bwalmart\b/i, slug: "walmart" },
  { match: /\bbest\s*buy\b/i, slug: "best-buy" },
  { match: /\bgamestop\b/i, slug: "gamestop" },
  { match: /\bpok[eé]mon\s*center\b/i, slug: "pokemon-center" },
  { match: /\bamazon\b/i, slug: "amazon" },
];

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function parseRetailer(text: string): RetailerSlug | null {
  for (const a of RETAILER_ALIASES) {
    if (a.match.test(text)) return a.slug;
  }
  return null;
}

function statusFromClass(cls: string): StockStatus {
  if (/stockStatusIn|stockStatusAvailable/i.test(cls)) return "in_stock";
  if (/stockStatusPre/i.test(cls)) return "limited";
  if (/stockStatusOut/i.test(cls)) return "out";
  return "unknown";
}

function matchProduct(name: string, products: TrackedProduct[]): string | null {
  const n = name.toLowerCase();
  let best: { id: string; score: number } | null = null;
  for (const p of products) {
    const tokens = p.name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !["the", "and", "box"].includes(t));
    const hits = tokens.filter((t) => n.includes(t)).length;
    const score = hits / Math.max(tokens.length, 1);
    if (hits >= 2 && score >= 0.45) {
      if (!best || score > best.score) best = { id: p.id, score };
    }
  }
  return best?.id ?? null;
}

export async function scrapeNowInStock(
  products: TrackedProduct[],
): Promise<WebStockSignal[]> {
  const res = await fetch(NOWINSTOCK_URL, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(25000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`NowInStock HTTP ${res.status}`);
  }
  const html = await res.text();
  const rows = html.split(/<tr[^>]*>/i);
  const now = new Date().toISOString();
  const signals: WebStockSignal[] = [];

  for (const row of rows) {
    const statusMatch = row.match(/class="(stockStatus\w+)"/i);
    if (!statusMatch) continue;
    const status = statusFromClass(statusMatch[1]);
    const hrefs = [...row.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]);
    const text = stripTags(row);
    if (!text || text.length < 8) continue;
    // Typical: "Product : Retailer In Stock $12.99 Jul 27 26 - 9:05 AM"
    const parts = text.split(/\s+:\s+/);
    const productName = (parts[0] || text).trim();
    const rest = parts.slice(1).join(" : ");
    const retailerSlug = parseRetailer(rest || text);
    if (!retailerSlug && !/ebay/i.test(text)) {
      // still keep unknown retailer signals that look like stock rows
      if (!/\b(in stock|out of stock|pre-?order)\b/i.test(text)) continue;
    }
    if (/ebay/i.test(text) && !retailerSlug) continue;

    const productId = matchProduct(productName, products);
    const buyUrl =
      hrefs.find((h) =>
        /target\.com|walmart\.com|bestbuy\.com|gamestop\.com|amazon\.com|pokemoncenter\.com/i.test(
          h,
        ),
      ) || hrefs[0] || null;

    signals.push({
      id: `nis-${simpleHash(`${productName}|${retailerSlug}|${status}`)}`,
      sourceSite: "nowinstock.net",
      title: `${productName} — ${retailerSlug || "retailer"} ${status.replace("_", " ")}`,
      url: buyUrl,
      retailerSlug,
      productId,
      productName,
      status,
      observedAt: now,
      raw: text.slice(0, 240),
    });
  }

  return signals;
}

function simpleHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** Best-effort Reddit restock mentions via PullPush (may lag). */
export async function scrapeRedditSignals(
  products: TrackedProduct[],
): Promise<WebStockSignal[]> {
  const queries = ["restock", "in stock Target", "Walmart pokemon", "Pokemon Center drop"];
  const out: WebStockSignal[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    const url = `https://api.pullpush.io/reddit/search/submission/?subreddit=PokemonTCG&q=${encodeURIComponent(q)}&size=15&sort=desc`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: Array<{
          id?: string;
          title?: string;
          url?: string;
          permalink?: string;
          created_utc?: number;
          selftext?: string;
        }>;
      };
      for (const post of json.data || []) {
        const id = post.id || post.permalink || post.title;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const title = post.title || "";
        const blob = `${title} ${post.selftext || ""}`;
        const retailerSlug = parseRetailer(blob);
        if (!retailerSlug) continue;
        if (!/\b(restock|in stock|just dropped|back in stock|sold out|out of stock)\b/i.test(blob)) {
          continue;
        }
        // Require sealed-product language so random restock chatter is skipped
        if (
          !/\b(etb|elite trainer|booster box|booster bundle|tin|upc|collection box|battle deck)\b/i.test(
            blob,
          )
        ) {
          continue;
        }
        const ageMs = post.created_utc ? Date.now() - post.created_utc * 1000 : Infinity;
        if (ageMs > 14 * 24 * 60 * 60 * 1000) continue;

        let status: StockStatus = "unknown";
        if (/\b(out of stock|sold out|empty)\b/i.test(blob)) status = "out";
        else if (/\b(in stock|restock|just dropped|back in stock|available now)\b/i.test(blob)) {
          status = "in_stock";
        }
        if (status === "unknown") continue;

        const productId = matchProduct(title, products);
        const link = post.url?.startsWith("http")
          ? post.url
          : post.permalink
            ? `https://www.reddit.com${post.permalink}`
            : null;
        const observedAt = post.created_utc
          ? new Date(post.created_utc * 1000).toISOString()
          : new Date().toISOString();

        out.push({
          id: `reddit-${id}`,
          sourceSite: "reddit/r/PokemonTCG",
          title: title.slice(0, 180),
          url: link,
          retailerSlug,
          productId,
          productName: productId
            ? products.find((p) => p.id === productId)?.name || title
            : title.slice(0, 120),
          status,
          observedAt,
          raw: blob.slice(0, 280),
        });
      }
    } catch {
      // ignore per-query failures
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // Prefer freshest 40
  return out
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, 40);
}

export async function collectWebSignals(
  products: TrackedProduct[],
): Promise<WebStockSignal[]> {
  const signals: WebStockSignal[] = [];
  try {
    signals.push(...(await scrapeNowInStock(products)));
  } catch (err) {
    console.warn("NowInStock scrape failed:", err);
  }
  try {
    signals.push(...(await scrapeRedditSignals(products)));
  } catch (err) {
    console.warn("Reddit signal scrape failed:", err);
  }

  // de-dupe by id
  const map = new Map<string, WebStockSignal>();
  for (const s of signals) map.set(s.id, s);
  return [...map.values()].sort((a, b) => b.observedAt.localeCompare(a.observedAt));
}

export function signalsToSnapshots(
  signals: WebStockSignal[],
  locations: Location[],
  retailerIdBySlug: Map<string, string>,
): StockSnapshot[] {
  const onlineByRetailer = new Map(
    locations.filter((l) => l.type === "online").map((l) => [l.retailerId, l.id]),
  );
  const now = new Date().toISOString();
  const snaps: StockSnapshot[] = [];

  for (const s of signals) {
    if (!s.retailerSlug || s.status === "unknown") continue;
    // Prefer matching a tracked product; otherwise still update online pin with a synthetic product key
    const productId = s.productId || `web:${s.sourceSite}:${s.productName.slice(0, 40)}`;
    const retailerId = retailerIdBySlug.get(s.retailerSlug);
    if (!retailerId) continue;
    const locationId = onlineByRetailer.get(retailerId) ?? null;

    snaps.push({
      id: `snap-web-${s.retailerSlug}-${productId}`,
      locationId,
      productId,
      retailerId,
      status: s.status,
      quantity: null,
      source: "web_signal",
      checkedAt: s.observedAt || now,
      note: `${s.sourceSite}: ${s.productName}`.slice(0, 180),
    });
  }
  return snaps;
}
