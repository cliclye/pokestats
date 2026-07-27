"use client";

import { useState } from "react";
import type { StockStatus, TrackedProduct } from "@/lib/types";

export function ReportForm({
  locationId,
  products,
  onSubmitted,
}: {
  locationId: string;
  products: TrackedProduct[];
  onSubmitted: () => void;
}) {
  const [status, setStatus] = useState<StockStatus>("in_stock");
  const [productId, setProductId] = useState("");
  const [note, setNote] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId,
          productId: productId || null,
          status,
          note,
          reporterLabel: label || "Anonymous",
        }),
      });
      if (!res.ok) throw new Error("Could not save report");
      setNote("");
      setMsg("Thanks — report recorded.");
      onSubmitted();
    } catch (err) {
      setMsg(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-3 border-t border-[var(--stroke)] pt-4">
      <h3 className="text-sm font-semibold text-[var(--electric)]">I was here</h3>
      <p className="text-xs text-[var(--muted)]">
        Community reports help fill gaps for shelves and vending machines. Confidence decays over
        ~6 hours.
      </p>
      <select
        className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--ink-2)] px-3 py-2 text-sm"
        value={status}
        onChange={(e) => setStatus(e.target.value as StockStatus)}
      >
        <option value="in_stock">In stock</option>
        <option value="limited">Limited / partial</option>
        <option value="out">Empty / out</option>
        <option value="unknown">Unclear</option>
      </select>
      <select
        className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--ink-2)] px-3 py-2 text-sm"
        value={productId}
        onChange={(e) => setProductId(e.target.value)}
      >
        <option value="">Any / general shelf</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--ink-2)] px-3 py-2 text-sm"
        placeholder="Optional note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={280}
      />
      <input
        className="w-full rounded-xl border border-[var(--stroke)] bg-[var(--ink-2)] px-3 py-2 text-sm"
        placeholder="Name (optional)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={40}
      />
      <button type="submit" disabled={busy} className="btn-primary w-full text-sm disabled:opacity-60">
        {busy ? "Sending…" : "Submit check-in"}
      </button>
      {msg && <p className="text-xs text-[var(--muted)]">{msg}</p>}
    </form>
  );
}
