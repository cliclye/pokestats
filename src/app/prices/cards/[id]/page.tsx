import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { readStore, upsertSetsAndCards } from "@/lib/store";
import { searchCardsLive } from "@/lib/pokemontcg";
import { cardHasPricedVariant, enrichCardFromTcgplayer } from "@/lib/tcgplayer";
import type { Card } from "@/lib/types";

export const dynamic = "force-dynamic";

function formatUsd(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function resolveCard(id: string): Promise<Card | null> {
  const store = await readStore();
  const local = store.cards.find((c) => c.id === id);

  if (local) {
    if (cardHasPricedVariant(local)) return local;
    const enriched = await enrichCardFromTcgplayer(local);
    if (cardHasPricedVariant(enriched)) {
      await upsertSetsAndCards([], [enriched]);
      return enriched;
    }
    return enriched;
  }

  // Try live lookup by id prefix name fragment
  const nameHint = id.split("-").slice(1).join(" ") || id;
  try {
    const live = await searchCardsLive(nameHint.replace(/\d+/g, "").trim() || id);
    const match = live.find((c) => c.id === id) || live[0];
    if (match) {
      await upsertSetsAndCards([], [match]);
      return match;
    }
  } catch {
    return null;
  }
  return null;
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await resolveCard(id);
  if (!card) notFound();

  const variants = Object.entries(card.prices);

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="prices" />
      <main className="mx-auto grid w-full max-w-5xl gap-10 px-5 pb-16 md:grid-cols-[280px_1fr] md:px-8">
        <div>
          <Link href={`/prices/sets/${card.setId}`} className="text-sm text-[var(--electric)]">
            ← {card.setName}
          </Link>
          <div className="relative mt-4 aspect-[5/7] overflow-hidden rounded-2xl border border-[var(--stroke)] bg-[var(--ink)]">
            {card.imageLarge || card.imageSmall ? (
              <Image
                src={card.imageLarge || card.imageSmall!}
                alt={card.name}
                fill
                className="object-contain p-3"
                sizes="280px"
                priority
              />
            ) : null}
          </div>
        </div>
        <div className="pt-8 md:pt-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {card.setName} · #{card.number}
          </p>
          <h1 className="font-display mt-2 text-4xl md:text-5xl">{card.name}</h1>
          <p className="mt-2 text-[var(--muted)]">
            {card.rarity || "—"}
            {card.artist ? ` · Art by ${card.artist}` : ""}
          </p>

          <div className="mt-8 space-y-3">
            <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--electric)]">
              TCGPlayer prices
            </h2>
            {variants.length === 0 && (
              <p className="text-[var(--muted)]">No price data for this printing yet.</p>
            )}
            {variants.map(([variant, prices]) => (
              <div
                key={variant}
                className="panel grid grid-cols-2 gap-3 rounded-2xl p-4 sm:grid-cols-4"
              >
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-sm font-semibold capitalize">{variant}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Market</p>
                  <p className="text-lg text-[var(--amber)]">{formatUsd(prices.market)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Low</p>
                  <p className="text-lg">{formatUsd(prices.low)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Mid</p>
                  <p className="text-lg">{formatUsd(prices.mid)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">High</p>
                  <p className="text-lg">{formatUsd(prices.high)}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-[var(--muted)]">
            Price updated:{" "}
            {card.priceUpdatedAt
              ? new Date(card.priceUpdatedAt).toLocaleString()
              : "unknown"}
            . Data via pokemontcg.io (TCGPlayer aggregate). Not real-time tick data.
          </p>
          {card.tcgplayerUrl && (
            <a
              href={card.tcgplayerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost mt-4 inline-flex text-sm"
            >
              View on TCGPlayer
            </a>
          )}
        </div>
      </main>
    </div>
  );
}
