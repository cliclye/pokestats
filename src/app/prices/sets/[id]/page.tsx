import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { readStore, upsertSetsAndCards } from "@/lib/store";
import { fetchCardsForSet, fetchAllSets } from "@/lib/pokemontcg";
import { cardHasPricedVariant, enrichCardsFromTcgplayer } from "@/lib/tcgplayer";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

function bestMarket(card: Card): number | null {
  const vals = Object.values(card.prices)
    .map((p) => p.market)
    .filter((v): v is number => typeof v === "number");
  return vals.length ? Math.max(...vals) : null;
}

function formatUsd(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function SetPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { id } = await params;
  const { sort = "number" } = await searchParams;
  const store = await readStore();
  let set = store.sets.find((s) => s.id === id);
  let cards = store.cards.filter((c) => c.setId === id);

  if (!set || cards.length === 0) {
    try {
      if (!set) {
        const all = await fetchAllSets();
        set = all.find((s) => s.id === id);
      }
      if (set) {
        cards = await fetchCardsForSet(id);
        await upsertSetsAndCards(set ? [set] : [], cards);
      }
    } catch {
      // keep empty
    }
  } else if (cards.some((c) => !cardHasPricedVariant(c))) {
    try {
      const enriched = await enrichCardsFromTcgplayer(cards, {
        concurrency: 4,
        delayMs: 80,
      });
      const changed = enriched.filter(
        (c, i) => cardHasPricedVariant(c) && !cardHasPricedVariant(cards[i]),
      );
      if (changed.length > 0) {
        await upsertSetsAndCards([], changed);
      }
      cards = enriched;
    } catch {
      // keep cached cards
    }
  }

  if (!set) notFound();

  if (sort === "price") {
    cards = [...cards].sort((a, b) => (bestMarket(b) ?? -1) - (bestMarket(a) ?? -1));
  } else {
    cards = [...cards].sort((a, b) =>
      a.number.localeCompare(b.number, undefined, { numeric: true }),
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="prices" />
      <main className="mx-auto w-full max-w-6xl px-5 pb-16 md:px-8">
        <Link href="/prices" className="text-sm text-[var(--electric)]">
          ← All sets
        </Link>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl md:text-5xl">{set.name}</h1>
            <p className="mt-2 text-[var(--muted)]">
              {set.series} · Released {set.releaseDate} · {set.printedTotal} printed
            </p>
          </div>
          <div className="flex gap-2 text-sm">
            <Link
              href={`/prices/sets/${id}?sort=number`}
              className={`rounded-full px-3 py-1.5 border border-[var(--stroke)] ${sort !== "price" ? "text-[var(--electric)]" : ""}`}
            >
              By number
            </Link>
            <Link
              href={`/prices/sets/${id}?sort=price`}
              className={`rounded-full px-3 py-1.5 border border-[var(--stroke)] ${sort === "price" ? "text-[var(--electric)]" : ""}`}
            >
              By price
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={`/prices/cards/${card.id}`}
              className="overflow-hidden rounded-xl border border-[var(--stroke)] bg-[rgba(8,22,17,0.55)] transition hover:border-[rgba(92,255,176,0.45)]"
            >
              <div className="relative aspect-[5/7] bg-[var(--ink)]">
                {card.imageSmall ? (
                  <Image
                    src={card.imageSmall}
                    alt={card.name}
                    fill
                    className="object-contain p-2"
                    sizes="160px"
                  />
                ) : null}
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-semibold">{card.name}</p>
                <p className="text-xs text-[var(--muted)]">#{card.number}</p>
                <p className="text-sm text-[var(--amber)]">{formatUsd(bestMarket(card))}</p>
              </div>
            </Link>
          ))}
        </div>
        {cards.length === 0 && (
          <p className="mt-8 text-[var(--muted)]">
            No cards loaded for this set. Check your network or pokemontcg.io rate limit.
          </p>
        )}
      </main>
    </div>
  );
}
