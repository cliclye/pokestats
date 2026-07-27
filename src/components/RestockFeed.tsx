"use client";

import type { StockStatus, WebStockSignal } from "@/lib/types";

function statusLabel(s: StockStatus) {
  switch (s) {
    case "in_stock":
      return "In stock";
    case "limited":
      return "Limited";
    case "out":
      return "Out";
    default:
      return "Unknown";
  }
}

function statusDot(s: StockStatus) {
  switch (s) {
    case "in_stock":
      return "#22c55e";
    case "limited":
      return "#eab308";
    case "out":
      return "#ef4444";
    default:
      return "#64748b";
  }
}

export function RestockFeed({
  signals,
  syncedAt,
}: {
  signals: WebStockSignal[];
  syncedAt: string | null;
}) {
  if (!signals.length) {
    return (
      <div className="panel pointer-events-auto mt-2 max-w-md rounded-2xl p-3 text-xs text-[var(--muted)]">
        No live web stock signals yet. Run{" "}
        <code className="text-[var(--electric)]">npm run sync:signals</code> to scrape NowInStock /
        public restock posts.
      </div>
    );
  }

  return (
    <div className="panel pointer-events-auto mt-2 max-h-56 w-full max-w-md overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between border-b border-[var(--stroke)] px-3 py-2">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--electric)]">
          Live web stock · auto
        </p>
        <p className="text-[10px] text-[var(--muted)]">
          {syncedAt ? new Date(syncedAt).toLocaleTimeString() : "—"}
        </p>
      </div>
      <ul className="max-h-44 overflow-y-auto px-2 py-1">
        {signals.map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-2 border-b border-[var(--stroke)]/50 px-1 py-2 last:border-0"
          >
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{ background: statusDot(s.status) }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--fog)]">{s.productName}</p>
              <p className="text-[10px] text-[var(--muted)]">
                {s.retailerSlug || "retailer"} · {statusLabel(s.status)} · {s.sourceSite}
              </p>
            </div>
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[10px] text-[var(--electric)] hover:underline"
              >
                Open
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
