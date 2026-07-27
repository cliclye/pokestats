import { NextResponse } from "next/server";
import { readStore, upsertSetsAndCards } from "@/lib/store";
import { searchCardsLive } from "@/lib/pokemontcg";
import { cardHasPricedVariant, enrichCardsFromTcgplayer } from "@/lib/tcgplayer";

export const dynamic = "force-dynamic";

function marketPrice(card: { prices: Record<string, { market: number | null }> }) {
  const vals = Object.values(card.prices)
    .map((p) => p.market)
    .filter((v): v is number => typeof v === "number");
  return vals.length ? Math.max(...vals) : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  const setId = searchParams.get("setId");
  const sort = searchParams.get("sort") || "number";

  const store = await readStore();
  let cards = store.cards;

  if (setId) {
    cards = cards.filter((c) => c.setId === setId);
  }

  if (q) {
    const lower = q.toLowerCase();
    const local = cards.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.number.toLowerCase().includes(lower) ||
        c.setName.toLowerCase().includes(lower) ||
        c.id.toLowerCase().includes(lower),
    );

    if (local.length > 0 || store.cards.length === 0) {
      // If no local catalog yet, try live API; else prefer local hits
      if (local.length === 0) {
        try {
          cards = await searchCardsLive(q);
        } catch {
          cards = local;
        }
      } else {
        cards = local;
      }
    } else {
      try {
        cards = await searchCardsLive(q);
      } catch {
        cards = local;
      }
    }
  }

  // Enrich a page of unpriced cards so search/set views show TCGPlayer markets
  // even when pokemontcg.io only returned a product URL.
  const page = cards.slice(0, 120);
  const needsEnrichment = page.some((c) => !cardHasPricedVariant(c));
  if (needsEnrichment) {
    const enrichedPage = await enrichCardsFromTcgplayer(page, {
      concurrency: 4,
      delayMs: 60,
    });
    const enriched = enrichedPage.filter(
      (c, i) => cardHasPricedVariant(c) && !cardHasPricedVariant(page[i]),
    );
    if (enriched.length > 0) {
      await upsertSetsAndCards([], enriched);
    }
    cards = [
      ...enrichedPage,
      ...cards.slice(120),
    ];
  }

  if (sort === "price") {
    cards = [...cards].sort((a, b) => (marketPrice(b) ?? -1) - (marketPrice(a) ?? -1));
  } else if (sort === "name") {
    cards = [...cards].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    cards = [...cards].sort((a, b) => {
      const an = Number.parseInt(a.number, 10);
      const bn = Number.parseInt(b.number, 10);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
  }

  return NextResponse.json({
    cards: cards.slice(0, 120),
    meta: store.meta,
    total: cards.length,
  });
}
