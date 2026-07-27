import type {
  Location,
  MapLocationView,
  Retailer,
  StockReport,
  StockSnapshot,
  StockStatus,
  StockSource,
} from "./types";

const COMMUNITY_HALF_LIFE_MS = 6 * 60 * 60 * 1000; // 6 hours
const ONLINE_STALE_MS = 30 * 60 * 1000; // 30 minutes

export function formatFreshness(iso: string | null | undefined): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function communityConfidence(createdAt: string): number {
  const age = Date.now() - new Date(createdAt).getTime();
  const conf = Math.exp(-age / COMMUNITY_HALF_LIFE_MS);
  return Math.max(0, Math.min(1, conf));
}

function sourceLabel(source: StockSource): string {
  switch (source) {
    case "online_poll":
      return "Online";
    case "store_api":
      return "Store API";
    case "community":
      return "Community";
    case "web_signal":
      return "Web scrape";
    default:
      return "Location only";
  }
}

export function buildMapViews(
  locations: Location[],
  retailers: Retailer[],
  snapshots: StockSnapshot[],
  reports: StockReport[],
  productId?: string | null,
): MapLocationView[] {
  const retailerById = new Map(retailers.map((r) => [r.id, r]));

  return locations.map((location) => {
    const retailer = retailerById.get(location.retailerId)!;

    const locSnaps = snapshots
      .filter((s) => {
        if (s.locationId !== location.id && !(s.locationId === null && location.type === "online")) {
          // Also match online snapshots by retailer for online locations
          if (location.type === "online" && s.locationId === null && s.retailerId === location.retailerId) {
            return productId ? s.productId === productId : true;
          }
          return false;
        }
        return productId ? s.productId === productId : true;
      })
      .sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));

    const latestStock = locSnaps[0] ?? null;

    const locReports = reports
      .filter((r) => {
        if (r.locationId !== location.id) return false;
        if (productId && r.productId && r.productId !== productId) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const latestReport = locReports[0] ?? null;

    let effectiveStatus: StockStatus = "unknown";
    let source: StockSource = "location_only";
    let freshnessIso: string | null = null;
    let confidence = 0.2;

    const reportConf = latestReport ? communityConfidence(latestReport.createdAt) : 0;
    const stockAge = latestStock
      ? Date.now() - new Date(latestStock.checkedAt).getTime()
      : Infinity;
    const stockFresh = latestStock && stockAge < ONLINE_STALE_MS;
    const webFresh =
      latestStock?.source === "web_signal" &&
      stockAge < 2 * 60 * 60 * 1000;

    // Prefer fresh online/store polls; then fresh web scrapes; then community
    if (stockFresh && latestStock && latestStock.source !== "web_signal") {
      effectiveStatus = latestStock.status;
      source = latestStock.source;
      freshnessIso = latestStock.checkedAt;
      confidence = 0.85;
    } else if (webFresh && latestStock) {
      effectiveStatus = latestStock.status;
      source = "web_signal";
      freshnessIso = latestStock.checkedAt;
      confidence = 0.7;
    } else if (latestReport && reportConf > 0.35) {
      effectiveStatus = latestReport.status;
      source = "community";
      freshnessIso = latestReport.createdAt;
      confidence = reportConf;
    } else if (latestStock) {
      effectiveStatus = latestStock.status;
      source = latestStock.source;
      freshnessIso = latestStock.checkedAt;
      confidence = Math.max(0.25, 0.85 - stockAge / (4 * ONLINE_STALE_MS));
    }

    return {
      location,
      retailer,
      latestStock,
      latestReport,
      effectiveStatus,
      source,
      freshnessLabel: `${sourceLabel(source)} · ${formatFreshness(freshnessIso)}`,
      confidence,
    };
  });
}

export function statusColor(status: StockStatus): string {
  switch (status) {
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
