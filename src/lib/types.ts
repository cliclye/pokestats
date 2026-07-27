export type RetailerSlug =
  | "target"
  | "walmart"
  | "pokemon-center"
  | "best-buy"
  | "gamestop"
  | "vending"
  | "amazon";

export type LocationType = "store" | "vending" | "online";

export type StockStatus = "in_stock" | "out" | "limited" | "unknown";

export type StockSource =
  | "online_poll"
  | "store_api"
  | "community"
  | "web_signal"
  | "location_only";

export interface Retailer {
  id: string;
  slug: RetailerSlug;
  name: string;
  color: string;
}

export interface Location {
  id: string;
  retailerId: string;
  name: string;
  type: LocationType;
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  zip: string;
  externalId?: string;
}

export interface TrackedProduct {
  id: string;
  name: string;
  setCode: string;
  category: "etb" | "booster_bundle" | "tin" | "collection" | "other";
  imageUrl?: string;
  retailerSkus: Partial<Record<RetailerSlug, string>>;
  retailerUrls: Partial<Record<RetailerSlug, string>>;
}

export interface StockSnapshot {
  id: string;
  locationId: string | null;
  productId: string;
  retailerId: string;
  status: StockStatus;
  quantity: number | null;
  source: StockSource;
  checkedAt: string;
  note?: string;
}

export interface StockReport {
  id: string;
  locationId: string;
  productId: string | null;
  status: StockStatus;
  note: string;
  reporterLabel: string;
  createdAt: string;
}

/** Scraped restock / availability signal from public websites or posts */
export interface WebStockSignal {
  id: string;
  sourceSite: string;
  title: string;
  url: string | null;
  retailerSlug: RetailerSlug | null;
  productId: string | null;
  productName: string;
  status: StockStatus;
  observedAt: string;
  raw: string;
}

export interface CardSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  total: number;
  printedTotal: number;
  imageSymbol?: string;
  imageLogo?: string;
}

export interface CardPriceVariant {
  low: number | null;
  mid: number | null;
  high: number | null;
  market: number | null;
  directLow: number | null;
}

export interface Card {
  id: string;
  name: string;
  number: string;
  rarity: string | null;
  setId: string;
  setName: string;
  artist: string | null;
  imageSmall: string | null;
  imageLarge: string | null;
  tcgplayerUrl: string | null;
  prices: Record<string, CardPriceVariant>;
  priceUpdatedAt: string | null;
}

export interface MapLocationView {
  location: Location;
  retailer: Retailer;
  latestStock: StockSnapshot | null;
  latestReport: StockReport | null;
  effectiveStatus: StockStatus;
  source: StockSource;
  freshnessLabel: string;
  confidence: number;
}

export interface AppStore {
  retailers: Retailer[];
  locations: Location[];
  products: TrackedProduct[];
  snapshots: StockSnapshot[];
  reports: StockReport[];
  webSignals: WebStockSignal[];
  sets: CardSet[];
  cards: Card[];
  meta: {
    pricesSyncedAt: string | null;
    stockPolledAt: string | null;
    webSignalsSyncedAt: string | null;
  };
}
