import type { Card, CardPriceVariant } from "./types";

const UA = "PokeStats/1.0 (price enrichment; local app)";

interface PricePoint {
  printingType?: string;
  marketPrice?: number | null;
  buylistMarketPrice?: number | null;
  listedMedianPrice?: number | null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function camelVariant(printingType: string): string {
  const cleaned = printingType.trim().replace(/[^a-zA-Z0-9]+/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "normal";
  const [first, ...rest] = parts;
  return (
    first.toLowerCase() +
    rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("")
  );
}

/** Map TCGPlayer printing labels onto pokemontcg.io-style variant keys. */
export function mapPrintingType(printingType: string): string {
  const lower = printingType.trim().toLowerCase();
  if (lower === "foil" || lower === "holo" || lower === "holofoil") return "holofoil";
  if (lower === "normal" || lower === "nonfoil" || lower === "non-foil") return "normal";
  if (lower.includes("reverse")) return "reverseHolofoil";
  if (lower.includes("1st") && lower.includes("holo")) return "1stEditionHolofoil";
  if (lower.includes("unlimited") && lower.includes("holo")) return "unlimitedHolofoil";
  return camelVariant(printingType);
}

export function extractTcgplayerProductId(input: string | null | undefined): string | null {
  if (!input) return null;
  const direct = input.match(/tcgplayer\.com\/product\/(\d+)/i);
  if (direct?.[1]) return direct[1];
  const encoded = input.match(/tcgplayer\.com%2Fproduct%2F(\d+)/i);
  if (encoded?.[1]) return encoded[1];
  return null;
}

export async function resolveTcgplayerProductId(
  cardId: string,
  tcgplayerUrl?: string | null,
): Promise<string | null> {
  const fromUrl = extractTcgplayerProductId(tcgplayerUrl);
  if (fromUrl) return fromUrl;

  const lookupUrl =
    tcgplayerUrl && tcgplayerUrl.includes("prices.pokemontcg.io")
      ? tcgplayerUrl
      : `https://prices.pokemontcg.io/tcgplayer/${cardId}`;

  try {
    const res = await fetch(lookupUrl, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "*/*" },
      signal: AbortSignal.timeout(15000),
    });
    const location = res.headers.get("location");
    const fromLocation = extractTcgplayerProductId(location);
    if (fromLocation) return fromLocation;

    // Some environments strip Location on HEAD; try a tiny GET without following redirects.
    const getRes = await fetch(lookupUrl, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(15000),
    });
    const loc2 = getRes.headers.get("location");
    const fromLoc2 = extractTcgplayerProductId(loc2);
    if (fromLoc2) return fromLoc2;
    const body = await getRes.text();
    return extractTcgplayerProductId(body);
  } catch {
    return null;
  }
}

async function fetchProductDetails(productId: string): Promise<{
  marketPrice: number | null;
  lowestPrice: number | null;
  medianPrice: number | null;
} | null> {
  try {
    const detailRes = await fetch(
      `https://mp-search-api.tcgplayer.com/v1/product/${productId}/details`,
      {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!detailRes.ok) return null;
    const detail = (await detailRes.json()) as {
      marketPrice?: number | null;
      lowestPrice?: number | null;
      medianPrice?: number | null;
    };
    return {
      marketPrice: typeof detail.marketPrice === "number" ? detail.marketPrice : null,
      lowestPrice: typeof detail.lowestPrice === "number" ? detail.lowestPrice : null,
      medianPrice: typeof detail.medianPrice === "number" ? detail.medianPrice : null,
    };
  } catch {
    return null;
  }
}

export async function fetchTcgplayerPricePoints(
  productId: string,
): Promise<Record<string, CardPriceVariant>> {
  const res = await fetch(`https://mpapi.tcgplayer.com/v2/product/${productId}/pricepoints`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`TCGPlayer pricepoints ${res.status}`);
  }
  const points = (await res.json()) as PricePoint[];
  const variants: Record<string, CardPriceVariant> = {};
  const details = await fetchProductDetails(productId);

  for (const point of points) {
    if (!point.printingType) continue;
    const market = typeof point.marketPrice === "number" ? point.marketPrice : null;
    const mid = typeof point.listedMedianPrice === "number" ? point.listedMedianPrice : null;
    if (market == null && mid == null) continue;
    const key = mapPrintingType(point.printingType);
    variants[key] = {
      low: details?.lowestPrice ?? null,
      mid: mid ?? details?.medianPrice ?? null,
      high: null,
      market: market ?? mid ?? details?.marketPrice ?? null,
      directLow: null,
    };
  }

  // Product-level fallback when printings are empty/null but the card still has a market.
  if (Object.keys(variants).length === 0 && details) {
    const { marketPrice: market, lowestPrice: low, medianPrice: mid } = details;
    if (market != null || low != null || mid != null) {
      variants.holofoil = {
        low,
        mid,
        high: null,
        market: market ?? mid ?? low,
        directLow: null,
      };
    }
  }

  return variants;
}

export function cardHasPricedVariant(card: Pick<Card, "prices">): boolean {
  return Object.values(card.prices || {}).some(
    (p) =>
      typeof p?.market === "number" ||
      typeof p?.mid === "number" ||
      typeof p?.low === "number" ||
      typeof p?.high === "number",
  );
}

/** Fill empty pokemontcg.io price payloads from TCGPlayer's public pricepoints API. */
export async function enrichCardFromTcgplayer(card: Card): Promise<Card> {
  if (cardHasPricedVariant(card)) return card;
  if (!card.tcgplayerUrl && !card.id) return card;

  const productId = await resolveTcgplayerProductId(card.id, card.tcgplayerUrl);
  if (!productId) return card;

  try {
    const variants = await fetchTcgplayerPricePoints(productId);
    if (Object.keys(variants).length === 0) return card;
    return {
      ...card,
      prices: variants,
      priceUpdatedAt: new Date().toISOString(),
      tcgplayerUrl: card.tcgplayerUrl || `https://www.tcgplayer.com/product/${productId}`,
    };
  } catch {
    return card;
  }
}

export async function enrichCardsFromTcgplayer(
  cards: Card[],
  opts: { concurrency?: number; delayMs?: number } = {},
): Promise<Card[]> {
  const concurrency = opts.concurrency ?? 4;
  const delayMs = opts.delayMs ?? 120;
  const out = [...cards];
  let cursor = 0;

  async function worker() {
    while (cursor < out.length) {
      const idx = cursor++;
      const card = out[idx];
      if (cardHasPricedVariant(card)) continue;
      out[idx] = await enrichCardFromTcgplayer(card);
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, out.length) }, () => worker()));
  return out;
}
