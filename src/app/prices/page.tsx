import { Nav } from "@/components/Nav";
import { PriceSearch } from "@/components/PriceSearch";
import { readStore } from "@/lib/store";
import { fetchAllSets } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  const store = await readStore();
  let sets = store.sets;
  if (sets.length === 0) {
    try {
      sets = await fetchAllSets();
    } catch {
      sets = [];
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <Nav active="prices" />
      <div className="px-5 pt-4 md:px-8">
        <h1 className="font-display text-4xl text-[var(--fog)] md:text-5xl">Card prices</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">
          Search any card or browse by the pack/set it comes from. Values come from TCGPlayer market
          data via the free Pokémon TCG API.
        </p>
      </div>
      <div className="mt-6">
        <PriceSearch initialSets={sets} />
      </div>
    </div>
  );
}
