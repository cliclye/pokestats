import { createClient } from "@supabase/supabase-js";
import { SET_CATALOG, isMsrpRetailer } from "./stock/product-taxonomy";
import { sendSms, smsConfigured } from "./sms";
import type { TrackedProduct, WebStockSignal } from "./types";

export type StockAlert = {
  id: string;
  phoneE164: string;
  setCodes: string[];
  productIds: string[];
  active: boolean;
  unsubscribeToken: string;
  lastNotifiedAt: string | null;
  lastNotifiedFingerprint: string | null;
  createdAt: string;
};

const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours between identical alerts

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function jobsSecret() {
  return process.env.JOBS_SECRET || process.env.CRON_SECRET || "";
}

function setLabel(code: string) {
  return SET_CATALOG.find((s) => s.code === code)?.label || code.toUpperCase();
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://pokestats-iota.vercel.app"
  ).replace(/\/$/, "");
}

export function normalizeUsPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export async function subscribeStockAlert(opts: {
  phone: string;
  setCodes: string[];
  productIds?: string[];
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("supabase_unavailable");

  const { data, error } = await supabase.rpc("subscribe_stock_alert", {
    p_phone: opts.phone,
    p_set_codes: opts.setCodes,
    p_product_ids: opts.productIds || [],
  });
  if (error) throw error;
  return data as { id: string; unsubscribeToken: string; phone: string };
}

export async function unsubscribeStockAlert(token: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("supabase_unavailable");
  const { data, error } = await supabase.rpc("unsubscribe_stock_alert", {
    p_token: token,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function listActiveAlerts(): Promise<StockAlert[]> {
  const supabase = getSupabase();
  const secret = jobsSecret();
  if (!supabase || !secret) return [];

  const { data, error } = await supabase.rpc("job_list_stock_alerts", {
    p_secret: secret,
  });
  if (error) throw error;
  return (data || []) as StockAlert[];
}

async function markNotified(id: string, fingerprint: string) {
  const supabase = getSupabase();
  const secret = jobsSecret();
  if (!supabase || !secret) return;
  await supabase.rpc("job_mark_alert_notified", {
    p_secret: secret,
    p_id: id,
    p_fingerprint: fingerprint,
  });
}

function matchingHits(
  alert: StockAlert,
  signals: WebStockSignal[],
  products: TrackedProduct[],
) {
  const productById = new Map(products.map((p) => [p.id, p]));
  const setCodes = new Set(alert.setCodes || []);
  const productIds = new Set(alert.productIds || []);

  return signals.filter((s) => {
    if (s.status !== "in_stock" && s.status !== "limited") return false;
    if (!isMsrpRetailer(s.retailerSlug)) return false;

    if (s.productId && productIds.has(s.productId)) return true;

    const product = s.productId ? productById.get(s.productId) : undefined;
    if (product && setCodes.has(product.setCode)) return true;

    // Fallback: match set from product name when signal has no productId
    if (!s.productId && setCodes.size) {
      for (const code of setCodes) {
        const entry = SET_CATALOG.find((c) => c.code === code);
        if (entry?.match.test(s.productName)) return true;
      }
    }
    return false;
  });
}

function buildFingerprint(hits: WebStockSignal[]) {
  return hits
    .map(
      (h) =>
        `${h.productId || h.productName}|${h.retailerSlug}|${h.status}|${h.url || ""}`,
    )
    .sort()
    .join("||");
}

function buildMessage(alert: StockAlert, hits: WebStockSignal[]) {
  const top = hits.slice(0, 3);
  const lines = top.map((h) => {
    const retailer = (h.retailerSlug || "retailer").replace(/-/g, " ");
    return `• ${h.productName} @ ${retailer}${h.url ? ` — ${h.url}` : ""}`;
  });
  const watched =
    (alert.setCodes || []).map(setLabel).join(", ") ||
    `${(alert.productIds || []).length} product(s)`;
  const more = hits.length > 3 ? `\n(+${hits.length - 3} more)` : "";
  const unsub = `${appBaseUrl()}/api/alerts?token=${alert.unsubscribeToken}`;
  return `PokeStats: ${watched} is in stock (MSRP sites).\n${lines.join("\n")}${more}\nStop: ${unsub}`;
}

export async function processStockAlerts(opts: {
  signals: WebStockSignal[];
  products: TrackedProduct[];
}) {
  const alerts = await listActiveAlerts();
  if (!alerts.length) {
    return { checked: 0, notified: 0, skipped: 0, smsReady: smsConfigured() };
  }

  let notified = 0;
  let skipped = 0;
  const now = Date.now();

  for (const alert of alerts) {
    const hits = matchingHits(alert, opts.signals, opts.products);
    if (!hits.length) continue;

    const fingerprint = buildFingerprint(hits);
    const lastAt = alert.lastNotifiedAt ? Date.parse(alert.lastNotifiedAt) : 0;
    const same =
      alert.lastNotifiedFingerprint &&
      alert.lastNotifiedFingerprint === fingerprint;
    if (same && now - lastAt < COOLDOWN_MS) {
      skipped += 1;
      continue;
    }

    const result = await sendSms(alert.phoneE164, buildMessage(alert, hits));
    if (result.ok) {
      await markNotified(alert.id, fingerprint);
      notified += 1;
    } else {
      if (!result.skipped) {
        console.error("[alerts] sms failed", alert.id, result.error);
      }
      skipped += 1;
    }
  }

  return {
    checked: alerts.length,
    notified,
    skipped,
    smsReady: smsConfigured(),
  };
}
