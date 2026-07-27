import { Nav } from "@/components/Nav";
import { WebStockChecker } from "@/components/WebStockChecker";

export const dynamic = "force-dynamic";

export default function WebStockPage() {
  return (
    <div className="flex min-h-full flex-col">
      <Nav active="web-stock" />
      <div className="px-5 pt-4 md:px-8">
        <h1 className="font-display text-4xl text-[var(--fog)] md:text-5xl">Web stock</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Automatically checks Target, Walmart, Best Buy, GameStop, Pokémon Center, Amazon, and
          NowInStock for sealed packs and boxes — no user reports required for online availability.
          Filter by pack line, box type, or a specific product.
        </p>
      </div>
      <div className="mt-6">
        <WebStockChecker />
      </div>
    </div>
  );
}
