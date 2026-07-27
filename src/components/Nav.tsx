import Link from "next/link";

const links = [
  { href: "/map", label: "Stock Map" },
  { href: "/web-stock", label: "Web Stock" },
  { href: "/prices", label: "Prices" },
];

export function Nav({
  active,
}: {
  active?: "map" | "web-stock" | "prices" | "home";
}) {
  return (
    <header className="relative z-40 flex items-center justify-between gap-4 px-5 py-4 md:px-8">
      <Link href="/" className="group flex items-baseline gap-2">
        <span className="font-display text-2xl tracking-tight text-[var(--electric)] transition-colors group-hover:text-[#9dffd0] md:text-3xl">
          PokeStats
        </span>
        <span className="hidden text-xs uppercase tracking-[0.2em] text-[var(--muted)] sm:inline">
          retail · market
        </span>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2">
        {links.map((l) => {
          const isActive =
            (active === "map" && l.href === "/map") ||
            (active === "web-stock" && l.href === "/web-stock") ||
            (active === "prices" && l.href === "/prices");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-full px-3 py-2 text-sm transition-colors sm:px-4 ${
                isActive
                  ? "bg-[rgba(92,255,176,0.12)] text-[var(--electric)]"
                  : "text-[var(--fog)]/80 hover:text-[var(--electric)]"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
