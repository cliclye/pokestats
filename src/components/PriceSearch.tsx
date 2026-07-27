"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { Card, CardSet } from "@/lib/types";

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

export function PriceSearch({ initialSets }: { initialSets: CardSet[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("name");
  const [cards, setCards] = useState<Card[]>([]);
  const [sets] = useState(initialSets);
  const [meta, setMeta] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) {
        setCards([]);
        setSearched(false);
        return;
      }
      startTransition(async () => {
        const res = await fetch(
          `/api/prices/search?q=${encodeURIComponent(q.trim())}&sort=${sort}`,
        );
        const json = await res.json();
        setCards(json.cards || []);
        setSearched(true);
        setMeta(
          json.meta?.pricesSyncedAt
            ? `Catalog refreshed ${new Date(json.meta.pricesSyncedAt).toLocaleString()}`
            : "Live / local search",
        );
      });
    }, 280);
    return () => clearTimeout(t);
  }, [q, sort]);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-16 md:px-8">
      <div className="animate-rise panel sticky top-2 z-20 rounded-2xl p-4 md:p-5">
        <label className="block text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
          Search cards
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Charizard, Pikachu, set name, number…"
            className="w-full flex-1 rounded-xl border border-[var(--stroke)] bg-[var(--ink)] px-4 py-3 text-base outline-none ring-[var(--electric)] focus:ring-1"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-xl border border-[var(--stroke)] bg-[var(--ink)] px-3 py-3 text-sm"
          >
            <option value="name">Sort: name</option>
            <option value="price">Sort: market price</option>
            <option value="number">Sort: number</option>
          </select>
        </div>
        {meta && <p className="mt-2 text-xs text-[var(--muted)]">{meta}</p>}
      </div>

      {pending && <p className="mt-4 text-sm text-[var(--muted)]">Searching…</p>}

      {searched && (
        <div className="animate-rise-delay mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {cards.map((card) => (
            <Link
              key={card.id}
              href={`/prices/cards/${card.id}`}
              className="group overflow-hidden rounded-xl border border-[var(--stroke)] bg-[rgba(8,22,17,0.55)] transition hover:border-[rgba(92,255,176,0.45)]"
            >
              <div className="relative aspect-[5/7] bg-[var(--ink)]">
                {card.imageSmall ? (
                  <Image
                    src={card.imageSmall}
                    alt={card.name}
                    fill
                    className="object-contain p-2 transition duration-300 group-hover:scale-[1.03]"
                    sizes="160px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
                    No image
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <p className="truncate text-sm font-semibold">{card.name}</p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {card.setName} · #{card.number}
                </p>
                <p className="text-sm text-[var(--amber)]">{formatUsd(bestMarket(card))}</p>
              </div>
            </Link>
          ))}
          {cards.length === 0 && (
            <p className="col-span-full text-sm text-[var(--muted)]">
              No cards found. Sync prices (`npm run sync:prices`) or try another query.
            </p>
          )}
        </div>
      )}

      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl text-[var(--fog)]">Browse by pack / set</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Open a set to see every card and market values from TCGPlayer (via pokemontcg.io).
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.slice(0, 24).map((set, i) => (
            <Link
              key={set.id}
              href={`/prices/sets/${set.id}`}
              className="animate-rise panel flex items-center gap-4 rounded-2xl p-4 transition hover:border-[rgba(92,255,176,0.4)]"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              {set.imageSymbol ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={set.imageSymbol} alt="" className="h-10 w-10 object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--felt)] text-xs">
                  SET
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{set.name}</p>
                <p className="text-xs text-[var(--muted)]">
                  {set.series} · {set.releaseDate} · {set.printedTotal} cards
                </p>
              </div>
            </Link>
          ))}
        </div>
        {sets.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            No sets cached yet. Run <code className="text-[var(--electric)]">npm run sync:prices</code>{" "}
            (free pokemontcg.io key optional but recommended).
          </p>
        )}
      </section>
    </div>
  );
}
