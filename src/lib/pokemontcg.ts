import type { Card, CardPriceVariant, CardSet } from "./types";
import {
  cardHasPricedVariant,
  enrichCardsFromTcgplayer,
} from "./tcgplayer";

const BASE = "https://api.pokemontcg.io/v2";

interface PtcgSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  total: number;
  printedTotal: number;
  images?: { symbol?: string; logo?: string };
}

interface PtcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  artist?: string;
  set: { id: string; name: string };
  images?: { small?: string; large?: string };
  tcgplayer?: {
    url?: string;
    updatedAt?: string;
    prices?: Record<
      string,
      {
        low?: number;
        mid?: number;
        high?: number;
        market?: number;
        directLow?: number | null;
      }
    >;
  };
}

export type SyncSetsOptions = {
  /** Max cards missing pokemontcg prices to enrich via TCGPlayer per set. */
  enrichMissingLimit?: number;
  enrichConcurrency?: number;
  enrichDelayMs?: number;
};

function headers(): HeadersInit {
  const h: Record<string, string> = { Accept: "application/json" };
  if (process.env.POKEMONTCG_API_KEY) {
    h["X-Api-Key"] = process.env.POKEMONTCG_API_KEY;
  }
  return h;
}

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(30000) });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`pokemontcg.io ${res.status}: ${await res.text()}`);
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        throw new Error(`pokemontcg.io ${res.status}: ${await res.text()}`);
      }
      return res.json() as Promise<T>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw lastError || new Error("pokemontcg.io request failed");
}

export async function fetchAllSets(): Promise<CardSet[]> {
  const data = await fetchJson<{ data: PtcgSet[] }>(`${BASE}/sets?orderBy=-releaseDate&pageSize=250`);
  return data.data.map((s) => ({
    id: s.id,
    name: s.name,
    series: s.series,
    releaseDate: s.releaseDate,
    total: s.total,
    printedTotal: s.printedTotal,
    imageSymbol: s.images?.symbol,
    imageLogo: s.images?.logo,
  }));
}

function mapPrices(
  prices?: PtcgCard["tcgplayer"],
): { variants: Record<string, CardPriceVariant>; updatedAt: string | null } {
  if (!prices?.prices) return { variants: {}, updatedAt: null };
  const variants: Record<string, CardPriceVariant> = {};
  for (const [key, val] of Object.entries(prices.prices)) {
    variants[key] = {
      low: val.low ?? null,
      mid: val.mid ?? null,
      high: val.high ?? null,
      market: val.market ?? null,
      directLow: val.directLow ?? null,
    };
  }
  return { variants, updatedAt: prices.updatedAt ?? null };
}

export async function fetchCardsForSet(
  setId: string,
  opts: SyncSetsOptions = {},
): Promise<Card[]> {
  const cards: Card[] = [];
  let page = 1;
  let totalCount = Infinity;
  while (cards.length < totalCount) {
    const data = await fetchJson<{ data: PtcgCard[]; totalCount: number }>(
      `${BASE}/cards?q=set.id:${setId}&page=${page}&pageSize=250`,
    );
    totalCount = data.totalCount;
    for (const c of data.data) {
      const { variants, updatedAt } = mapPrices(c.tcgplayer);
      cards.push({
        id: c.id,
        name: c.name,
        number: c.number,
        rarity: c.rarity ?? null,
        setId: c.set.id,
        setName: c.set.name,
        artist: c.artist ?? null,
        imageSmall: c.images?.small ?? null,
        imageLarge: c.images?.large ?? null,
        tcgplayerUrl: c.tcgplayer?.url ?? null,
        prices: variants,
        priceUpdatedAt: updatedAt,
      });
    }
    if (data.data.length === 0) break;
    page += 1;
    await new Promise((r) => setTimeout(r, 250));
  }

  // Newer sets often have tcgplayer.url but no prices on pokemontcg.io yet.
  // Cap enrichment so cron jobs finish before Vercel gateway timeouts (504).
  const enrichMissingLimit = opts.enrichMissingLimit ?? 40;
  if (enrichMissingLimit <= 0) return cards;

  const missingIdx: number[] = [];
  for (let i = 0; i < cards.length; i++) {
    if (!cardHasPricedVariant(cards[i])) missingIdx.push(i);
  }
  const sliceIdx = missingIdx.slice(0, enrichMissingLimit);
  if (!sliceIdx.length) return cards;

  const toEnrich = sliceIdx.map((i) => cards[i]);
  const enriched = await enrichCardsFromTcgplayer(toEnrich, {
    concurrency: opts.enrichConcurrency ?? 3,
    delayMs: opts.enrichDelayMs ?? 80,
  });
  for (let j = 0; j < sliceIdx.length; j++) {
    cards[sliceIdx[j]] = enriched[j];
  }
  return cards;
}

export async function searchCardsLive(query: string, pageSize = 40): Promise<Card[]> {
  const sanitized = query.replace(/"/g, "").trim();
  const q = encodeURIComponent(`name:${sanitized}*`);
  const data = await fetchJson<{ data: PtcgCard[] }>(
    `${BASE}/cards?q=${q}&pageSize=${pageSize}&orderBy=name`,
  );
  const cards = data.data.map((c) => {
    const { variants, updatedAt } = mapPrices(c.tcgplayer);
    return {
      id: c.id,
      name: c.name,
      number: c.number,
      rarity: c.rarity ?? null,
      setId: c.set.id,
      setName: c.set.name,
      artist: c.artist ?? null,
      imageSmall: c.images?.small ?? null,
      imageLarge: c.images?.large ?? null,
      tcgplayerUrl: c.tcgplayer?.url ?? null,
      prices: variants,
      priceUpdatedAt: updatedAt,
    };
  });
  return enrichCardsFromTcgplayer(cards, { concurrency: 3, delayMs: 80 });
}

export async function syncRecentSets(
  limit = 8,
  opts: SyncSetsOptions = {},
): Promise<{ sets: CardSet[]; cards: Card[]; syncedSetIds: string[]; errors: string[] }> {
  const allSets = await fetchAllSets();
  const sets = allSets.slice(0, limit);
  const cards: Card[] = [];
  const syncedSetIds: string[] = [];
  const errors: string[] = [];

  for (const set of sets) {
    try {
      const setCards = await fetchCardsForSet(set.id, {
        enrichMissingLimit: opts.enrichMissingLimit ?? 40,
        enrichConcurrency: opts.enrichConcurrency ?? 3,
        enrichDelayMs: opts.enrichDelayMs ?? 80,
      });
      cards.push(...setCards);
      syncedSetIds.push(set.id);
      console.log(`Synced ${set.name}: ${setCards.length} cards`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Skipping set ${set.id} (${set.name}):`, err);
      errors.push(`${set.id}: ${msg}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { sets: allSets, cards, syncedSetIds, errors };
}
