import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function HomePage() {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(92,255,176,0.18) 1px, transparent 0)",
          backgroundSize: "28px 28px",
          maskImage: "linear-gradient(to bottom, black 20%, transparent 85%)",
        }}
      />
      <Nav active="home" />
      <main className="relative z-10 flex flex-1 flex-col justify-center px-5 pb-20 pt-10 md:px-10 md:pt-6">
        <div className="mx-auto w-full max-w-5xl">
          <p className="animate-rise text-xs uppercase tracking-[0.28em] text-[var(--electric-dim)]">
            US retail · TCG market
          </p>
          <h1 className="animate-rise font-display mt-4 max-w-3xl text-5xl leading-[0.95] tracking-tight text-[var(--fog)] md:text-7xl">
            <span className="text-[var(--electric)]">PokeStats</span>
          </h1>
          <p className="animate-rise-delay mt-5 max-w-xl text-lg text-[var(--muted)] md:text-xl">
            See what&apos;s on shelves and what cards are worth — stock map across retailers and
            vending, prices from the TCG market.
          </p>
          <div className="animate-rise-delay mt-10 flex flex-wrap gap-3">
            <Link href="/map" className="btn-primary">
              Open stock map
            </Link>
            <Link href="/web-stock" className="btn-ghost">
              Web stock checker
            </Link>
            <Link href="/prices" className="btn-ghost">
              Check card prices
            </Link>
          </div>
        </div>
      </main>
      <footer className="relative z-10 px-5 py-6 text-xs text-[var(--muted)] md:px-10">
        Online polls + community reports. Shelf and vending inventory are never guaranteed from
        public data alone.
      </footer>
    </div>
  );
}
