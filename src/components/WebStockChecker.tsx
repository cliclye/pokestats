"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import type { StockStatus } from "@/lib/types";
import {
  CATEGORY_LABELS,
  categoryOptions,
  type ProductCategory,
} from "@/lib/stock/product-taxonomy";

type ProductOption = {
  id: string;
  name: string;
  setCode: string;
  category: ProductCategory | string;
  retailerUrls: Record<string, string>;
};

type EnrichedSignal = {
  id: string;
  sourceSite: string;
  title: string;
  url: string | null;
  retailerSlug: string | null;
  productId: string | null;
  productName: string;
  status: StockStatus;
  observedAt: string;
  category: ProductCategory;
  setCode: string | null;
  setLabel: string | null;
  matchedProductName: string | null;
};

type Facets = {
  categories: Array<{ id: ProductCategory; label: string }>;
  sets: Array<{ code: string; label: string }>;
  retailers: string[];
  sources: string[];
};

function statusLabel(s: StockStatus) {
  switch (s) {
    case "in_stock":
      return "In stock";
    case "limited":
      return "Limited";
    case "out":
      return "Out of stock";
    default:
      return "Unknown";
  }
}

function statusTone(s: StockStatus) {
  switch (s) {
    case "in_stock":
      return { bg: "rgba(34,197,94,0.15)", fg: "#4ade80", border: "rgba(34,197,94,0.35)" };
    case "limited":
      return { bg: "rgba(234,179,8,0.15)", fg: "#facc15", border: "rgba(234,179,8,0.35)" };
    case "out":
      return { bg: "rgba(239,68,68,0.12)", fg: "#f87171", border: "rgba(239,68,68,0.3)" };
    default:
      return { bg: "rgba(100,116,139,0.15)", fg: "#94a3b8", border: "rgba(100,116,139,0.3)" };
  }
}

function retailerLabel(slug: string | null) {
  if (!slug) return "Unknown site";
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function WebStockChecker() {
  const [signals, setSignals] = useState<EnrichedSignal[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [facets, setFacets] = useState<Facets>({
    categories: [],
    sets: [],
    retailers: [],
    sources: [],
  });
  const [meta, setMeta] = useState<{
    webSignalsSyncedAt: string | null;
    stockPolledAt?: string | null;
    pool: number;
    inStock: number;
    autoCheck?: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [setCode, setSetCode] = useState("all");
  const [productId, setProductId] = useState("all");
  const [retailer, setRetailer] = useState("all");
  const [status, setStatus] = useState<"all" | "in_stock" | "out" | "limited">("all");
  const [source, setSource] = useState("all");
  const [tick, setTick] = useState(0);

  const productChoices = useMemo(() => {
    let list = products;
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (setCode !== "all") list = list.filter((p) => p.setCode === setCode);
    return list;
  }, [products, category, setCode]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", "300");
    params.set("sealed", "1");
    params.set("msrp", "1");
    if (deferredQ.trim()) params.set("q", deferredQ.trim());
    if (category !== "all") params.set("category", category);
    if (setCode !== "all") params.set("set", setCode);
    if (productId !== "all") params.set("productId", productId);
    if (retailer !== "all") params.set("retailer", retailer);
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("source", source);

    const controller = new AbortController();
    startTransition(async () => {
      try {
        const res = await fetch(`/api/stock/signals?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setSignals(json.signals || []);
        setProducts(json.products || []);
        setFacets(json.facets || { categories: [], sets: [], retailers: [], sources: [] });
        setMeta({
          webSignalsSyncedAt: json.meta?.webSignalsSyncedAt ?? null,
          stockPolledAt: json.meta?.stockPolledAt ?? null,
          pool: json.meta?.pool ?? 0,
          inStock: json.meta?.inStock ?? 0,
          autoCheck: json.meta?.autoCheck,
        });
        setError(null);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError((e as Error).message || "Failed to load");
      }
    });
    return () => controller.abort();
  }, [deferredQ, category, setCode, productId, retailer, status, source, tick]);

  const cats = categoryOptions();

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-16 md:px-8">
      <div className="panel rounded-3xl p-4 md:p-5">
        <div className="mb-4 rounded-2xl border border-[rgba(92,255,176,0.22)] bg-[rgba(92,255,176,0.06)] px-4 py-3 text-sm text-[var(--fog)]">
          <p className="font-medium text-[var(--electric)]">MSRP retailers only</p>
          <p className="mt-1 text-[var(--muted)]">
            {meta?.autoCheck ||
              "Shows Target, Walmart, Best Buy, GameStop, and Pokémon Center — not Amazon/eBay reseller markup."}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Last web scrape:{" "}
            {meta?.webSignalsSyncedAt
              ? new Date(meta.webSignalsSyncedAt).toLocaleString()
              : "—"}
            {" · "}
            Last retailer poll:{" "}
            {meta?.stockPolledAt ? new Date(meta.stockPolledAt).toLocaleString() : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--electric-dim)]">
              Retailer websites
            </p>
            <h2 className="font-display mt-1 text-2xl text-[var(--fog)] md:text-3xl">
              Filter packs & boxes
            </h2>
          </div>
          <div className="text-right text-xs text-[var(--muted)]">
            <p>
              {meta?.inStock ?? 0} in stock / limited · {meta?.pool ?? 0} sealed listings
            </p>
            <p>{pending ? "Updating…" : "Auto-refreshes every minute"}</p>
          </div>
        </div>

        <div className="mt-4">
          <label className="sr-only" htmlFor="web-stock-search">
            Search products
          </label>
          <input
            id="web-stock-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ETB, booster box, bundle, tin…"
            className="w-full rounded-2xl border border-[var(--stroke)] bg-[rgba(0,0,0,0.25)] px-4 py-3 text-sm text-[var(--fog)] outline-none ring-[var(--electric)] placeholder:text-[var(--muted)] focus:ring-1"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {cats.map((c) => {
            const active = category === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory(c.id);
                  setProductId("all");
                }}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-[rgba(92,255,176,0.16)] text-[var(--electric)]"
                    : "border border-[var(--stroke)] text-[var(--muted)] hover:text-[var(--fog)]"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-[var(--muted)]">
            Set / pack line
            <select
              value={setCode}
              onChange={(e) => {
                setSetCode(e.target.value);
                setProductId("all");
              }}
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[rgba(0,0,0,0.25)] px-3 py-2.5 text-sm text-[var(--fog)]"
            >
              <option value="all">All sets</option>
              {facets.sets.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-[var(--muted)]">
            Specific product
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[rgba(0,0,0,0.25)] px-3 py-2.5 text-sm text-[var(--fog)]"
            >
              <option value="all">Any pack / box</option>
              {productChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-[var(--muted)]">
            Website
            <select
              value={retailer}
              onChange={(e) => setRetailer(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[rgba(0,0,0,0.25)] px-3 py-2.5 text-sm text-[var(--fog)]"
            >
              <option value="all">All retailers</option>
              {facets.retailers.map((r) => (
                <option key={r} value={r}>
                  {retailerLabel(r)}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-[var(--muted)]">
            Availability
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="mt-1 w-full rounded-xl border border-[var(--stroke)] bg-[rgba(0,0,0,0.25)] px-3 py-2.5 text-sm text-[var(--fog)]"
            >
              <option value="all">Any status</option>
              <option value="in_stock">In stock</option>
              <option value="limited">Limited / preorder</option>
              <option value="out">Out of stock</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { id: "all", label: "All sources" },
            { id: "auto-poll", label: "Direct site poll" },
            { id: "nowinstock.net", label: "NowInStock" },
            ...facets.sources
              .filter((s) => s !== "nowinstock.net" && s !== "auto-poll")
              .map((s) => ({ id: s, label: s })),
          ].map((s) => {
            const active = source === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                className={`rounded-full px-3 py-1 text-[11px] transition-colors ${
                  active
                    ? "bg-[rgba(255,200,87,0.14)] text-[var(--amber)]"
                    : "text-[var(--muted)] hover:text-[var(--fog)]"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="mt-4 text-sm text-[var(--coral)]">Could not load web stock: {error}</p>
      )}

      <div className="mt-6 space-y-2">
        {!pending && signals.length === 0 && (
          <div className="panel rounded-2xl p-6 text-sm text-[var(--muted)]">
            No matching sealed product listings. Try clearing filters, or wait for the next web stock
            sync.
          </div>
        )}

        {signals.map((s) => {
          const tone = statusTone(s.status);
          return (
            <article
              key={s.id}
              className="panel flex flex-col gap-3 rounded-2xl p-4 transition-colors hover:border-[rgba(92,255,176,0.35)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                    style={{
                      background: tone.bg,
                      color: tone.fg,
                      border: `1px solid ${tone.border}`,
                    }}
                  >
                    {statusLabel(s.status)}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    {retailerLabel(s.retailerSlug)}
                  </span>
                  {s.setLabel && (
                    <span className="rounded-full border border-[var(--stroke)] px-2 py-0.5 text-[11px] text-[var(--fog)]/80">
                      {s.setLabel}
                    </span>
                  )}
                  <span className="rounded-full border border-[var(--stroke)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                    {CATEGORY_LABELS[s.category] || s.category}
                  </span>
                </div>
                <h3 className="mt-2 truncate font-medium text-[var(--fog)]">{s.productName}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  via {s.sourceSite}
                  {s.observedAt ? ` · ${new Date(s.observedAt).toLocaleString()}` : ""}
                </p>
              </div>
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary shrink-0 px-4 py-2 text-sm"
                >
                  Open site
                </a>
              ) : (
                <span className="shrink-0 text-xs text-[var(--muted)]">No product link</span>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
