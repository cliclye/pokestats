import type { AppStore, Retailer, TrackedProduct } from "./types";

export const RETAILERS: Retailer[] = [
  { id: "r-target", slug: "target", name: "Target", color: "#CC0000" },
  { id: "r-walmart", slug: "walmart", name: "Walmart", color: "#0071CE" },
  { id: "r-pokemon-center", slug: "pokemon-center", name: "Pokémon Center", color: "#FFCB05" },
  { id: "r-best-buy", slug: "best-buy", name: "Best Buy", color: "#0046BE" },
  { id: "r-gamestop", slug: "gamestop", name: "GameStop", color: "#6B8E23" },
  { id: "r-amazon", slug: "amazon", name: "Amazon", color: "#FF9900" },
  { id: "r-vending", slug: "vending", name: "Pokémon Vending", color: "#E3350D" },
];

export const PRODUCTS: TrackedProduct[] = [
  {
    id: "p-sv8-etb",
    name: "Surging Sparks Elite Trainer Box",
    setCode: "sv8",
    category: "etb",
    retailerSkus: {
      target: "94608229",
      walmart: "14620821927",
      "pokemon-center": "710-02966",
      "best-buy": "6602924",
      gamestop: "423677",
    },
    retailerUrls: {
      target: "https://www.target.com/p/-/A-94608229",
      walmart: "https://www.walmart.com/ip/14620821927",
      "pokemon-center": "https://www.pokemoncenter.com/product/710-02966",
      "best-buy": "https://www.bestbuy.com/site/6602924.p",
      gamestop: "https://www.gamestop.com/toys-games/trading-cards/products/423677.html",
    },
  },
  {
    id: "p-sv8-bundle",
    name: "Surging Sparks Booster Bundle",
    setCode: "sv8",
    category: "booster_bundle",
    retailerSkus: {
      target: "94608231",
      walmart: "14620821945",
      "pokemon-center": "710-02968",
    },
    retailerUrls: {
      target: "https://www.target.com/p/-/A-94608231",
      walmart: "https://www.walmart.com/ip/14620821945",
      "pokemon-center": "https://www.pokemoncenter.com/product/710-02968",
    },
  },
  {
    id: "p-sv8-bb",
    name: "Surging Sparks Booster Box",
    setCode: "sv8",
    category: "booster_box",
    retailerSkus: {},
    retailerUrls: {
      "pokemon-center": "https://www.pokemoncenter.com/category/new-releases",
      amazon: "https://www.amazon.com/s?k=Surging+Sparks+Booster+Box",
    },
  },
  {
    id: "p-sv7-etb",
    name: "Stellar Crown Elite Trainer Box",
    setCode: "sv7",
    category: "etb",
    retailerSkus: {
      target: "93515818",
      walmart: "13718415318",
      "best-buy": "6594123",
      gamestop: "417892",
    },
    retailerUrls: {
      target: "https://www.target.com/p/-/A-93515818",
      walmart: "https://www.walmart.com/ip/13718415318",
      "best-buy": "https://www.bestbuy.com/site/6594123.p",
      gamestop: "https://www.gamestop.com/toys-games/trading-cards/products/417892.html",
    },
  },
  {
    id: "p-prismatic-etb",
    name: "Prismatic Evolutions Elite Trainer Box",
    setCode: "sv8pt5",
    category: "etb",
    retailerSkus: {
      target: "94300045",
      walmart: "14918200123",
      "pokemon-center": "710-03301",
      "best-buy": "6611001",
      gamestop: "428901",
    },
    retailerUrls: {
      target: "https://www.target.com/p/-/A-94300045",
      walmart: "https://www.walmart.com/ip/14918200123",
      "pokemon-center": "https://www.pokemoncenter.com/product/710-03301",
      "best-buy": "https://www.bestbuy.com/site/6611001.p",
      gamestop: "https://www.gamestop.com/toys-games/trading-cards/products/428901.html",
    },
  },
  {
    id: "p-prismatic-bundle",
    name: "Prismatic Evolutions Booster Bundle",
    setCode: "sv8pt5",
    category: "booster_bundle",
    retailerSkus: {},
    retailerUrls: {
      target: "https://www.target.com/s?searchTerm=prismatic+evolutions+booster+bundle",
      walmart: "https://www.walmart.com/search?q=prismatic+evolutions+booster+bundle",
      amazon: "https://www.amazon.com/s?k=Prismatic+Evolutions+Booster+Bundle",
    },
  },
  {
    id: "p-me-etb",
    name: "Mega Evolution Elite Trainer Box",
    setCode: "me1",
    category: "etb",
    retailerSkus: {},
    retailerUrls: {
      target: "https://www.target.com/s?searchTerm=mega+evolution+elite+trainer+box",
      walmart: "https://www.walmart.com/search?q=mega+evolution+elite+trainer+box",
      "pokemon-center": "https://www.pokemoncenter.com/category/new-releases",
      amazon: "https://www.amazon.com/s?k=Mega+Evolution+Elite+Trainer+Box",
    },
  },
  {
    id: "p-me-bundle",
    name: "Mega Evolution Perfect Order Booster Bundle",
    setCode: "me1",
    category: "booster_bundle",
    retailerSkus: {},
    retailerUrls: {
      amazon: "https://www.amazon.com/s?k=Mega+Evolution+Perfect+Order+Booster+Bundle",
      target: "https://www.target.com/s?searchTerm=mega+evolution+booster+bundle",
    },
  },
  {
    id: "p-me-bb",
    name: "Mega Evolution Booster Box",
    setCode: "me1",
    category: "booster_box",
    retailerSkus: {},
    retailerUrls: {
      "pokemon-center": "https://www.pokemoncenter.com/category/new-releases",
      amazon: "https://www.amazon.com/s?k=Mega+Evolution+Booster+Box",
    },
  },
  {
    id: "p-151-etb",
    name: "Scarlet & Violet 151 Elite Trainer Box",
    setCode: "sv3pt5",
    category: "etb",
    retailerSkus: {},
    retailerUrls: {
      amazon: "https://www.amazon.com/s?k=Pokemon+151+Elite+Trainer+Box",
      target: "https://www.target.com/s?searchTerm=pokemon+151+elite+trainer+box",
    },
  },
  {
    id: "p-paldean-etb",
    name: "Paldean Fates Elite Trainer Box",
    setCode: "sv4pt5",
    category: "etb",
    retailerSkus: {},
    retailerUrls: {
      amazon: "https://www.amazon.com/s?k=Paldean+Fates+Elite+Trainer+Box",
    },
  },
  {
    id: "p-shrouded-etb",
    name: "Shrouded Fable Elite Trainer Box",
    setCode: "sv6pt5",
    category: "etb",
    retailerSkus: {},
    retailerUrls: {
      amazon: "https://www.amazon.com/s?k=Shrouded+Fable+Elite+Trainer+Box",
    },
  },
];

/** Curated US metro seeds: major retailers + sample vending pins */
export function buildSeedLocations() {
  const stores = [
    // LA
    { retailerId: "r-target", name: "Target Hollywood", type: "store" as const, lat: 34.1016, lng: -118.3416, address: "7021 Hollywood Blvd", city: "Los Angeles", state: "CA", zip: "90028", externalId: "t-329" },
    { retailerId: "r-walmart", name: "Walmart Supercenter Pico Rivera", type: "store" as const, lat: 33.9831, lng: -118.0967, address: "8500 Washington Blvd", city: "Pico Rivera", state: "CA", zip: "90660", externalId: "w-2274" },
    { retailerId: "r-best-buy", name: "Best Buy West Hollywood", type: "store" as const, lat: 34.0837, lng: -118.3617, address: "100 N La Cienega Blvd", city: "Los Angeles", state: "CA", zip: "90048", externalId: "bb-687" },
    { retailerId: "r-gamestop", name: "GameStop Melrose", type: "store" as const, lat: 34.0836, lng: -118.3441, address: "7300 Melrose Ave", city: "Los Angeles", state: "CA", zip: "90046", externalId: "gs-4122" },
    { retailerId: "r-vending", name: "Pokémon Vending — Ralphs Hollywood", type: "vending" as const, lat: 34.0983, lng: -118.3287, address: "11361 Santa Monica Blvd", city: "Los Angeles", state: "CA", zip: "90025", externalId: "v-la-01" },
    // SF Bay
    { retailerId: "r-target", name: "Target Metreon", type: "store" as const, lat: 37.7845, lng: -122.4033, address: "789 Mission St", city: "San Francisco", state: "CA", zip: "94103", externalId: "t-2777" },
    { retailerId: "r-walmart", name: "Walmart Daly City", type: "store" as const, lat: 37.6688, lng: -122.4669, address: "301 Gellert Blvd", city: "Daly City", state: "CA", zip: "94015", externalId: "w-5159" },
    { retailerId: "r-vending", name: "Pokémon Vending — Safeway Mission", type: "vending" as const, lat: 37.7599, lng: -122.4148, address: "2020 Market St", city: "San Francisco", state: "CA", zip: "94114", externalId: "v-sf-01" },
    { retailerId: "r-best-buy", name: "Best Buy Union Square", type: "store" as const, lat: 37.7879, lng: -122.4075, address: "101 Stockton St", city: "San Francisco", state: "CA", zip: "94108", externalId: "bb-1435" },
    { retailerId: "r-gamestop", name: "GameStop Powell", type: "store" as const, lat: 37.7851, lng: -122.4080, address: "233 Powell St", city: "San Francisco", state: "CA", zip: "94102", externalId: "gs-8831" },
    // NYC
    { retailerId: "r-target", name: "Target Herald Square", type: "store" as const, lat: 40.7505, lng: -73.9885, address: "112 W 34th St", city: "New York", state: "NY", zip: "10120", externalId: "t-3288" },
    { retailerId: "r-best-buy", name: "Best Buy Union Square NYC", type: "store" as const, lat: 40.7374, lng: -73.9904, address: "52 E 14th St", city: "New York", state: "NY", zip: "10003", externalId: "bb-619" },
    { retailerId: "r-gamestop", name: "GameStop Times Square", type: "store" as const, lat: 40.7579, lng: -73.9855, address: "1515 Broadway", city: "New York", state: "NY", zip: "10036", externalId: "gs-1102" },
    { retailerId: "r-vending", name: "Pokémon Vending — Foodtown Brooklyn", type: "vending" as const, lat: 40.6782, lng: -73.9442, address: "1420 Fulton St", city: "Brooklyn", state: "NY", zip: "11216", externalId: "v-ny-01" },
    { retailerId: "r-walmart", name: "Walmart Brooklyn Gateway", type: "store" as const, lat: 40.6629, lng: -73.9108, address: "625 Atlantic Ave", city: "Brooklyn", state: "NY", zip: "11217", externalId: "w-5941" },
    // Chicago
    { retailerId: "r-target", name: "Target State Street", type: "store" as const, lat: 41.8837, lng: -87.6278, address: "1 S State St", city: "Chicago", state: "IL", zip: "60603", externalId: "t-2828" },
    { retailerId: "r-walmart", name: "Walmart Chatham", type: "store" as const, lat: 41.7436, lng: -87.6145, address: "10900 S Doty Ave", city: "Chicago", state: "IL", zip: "60628", externalId: "w-3640" },
    { retailerId: "r-vending", name: "Pokémon Vending — Jewel-Osco Lakeview", type: "vending" as const, lat: 41.9395, lng: -87.6533, address: "3630 N Southport Ave", city: "Chicago", state: "IL", zip: "60613", externalId: "v-chi-01" },
    { retailerId: "r-best-buy", name: "Best Buy Lincoln Park", type: "store" as const, lat: 41.9103, lng: -87.6498, address: "1000 W North Ave", city: "Chicago", state: "IL", zip: "60642", externalId: "bb-221" },
    { retailerId: "r-gamestop", name: "GameStop Wicker Park", type: "store" as const, lat: 41.9096, lng: -87.6773, address: "1550 N Milwaukee Ave", city: "Chicago", state: "IL", zip: "60622", externalId: "gs-5520" },
    // Seattle
    { retailerId: "r-target", name: "Target Northgate", type: "store" as const, lat: 47.7056, lng: -122.3273, address: "401 NE Northgate Way", city: "Seattle", state: "WA", zip: "98125", externalId: "t-612" },
    { retailerId: "r-vending", name: "Pokémon Vending — QFC Capitol Hill", type: "vending" as const, lat: 47.6253, lng: -122.3210, address: "500 Mercer St", city: "Seattle", state: "WA", zip: "98109", externalId: "v-sea-01" },
    { retailerId: "r-best-buy", name: "Best Buy Northgate", type: "store" as const, lat: 47.7089, lng: -122.3271, address: "1000 NE Northgate Way", city: "Seattle", state: "WA", zip: "98125", externalId: "bb-44" },
    { retailerId: "r-gamestop", name: "GameStop University Village", type: "store" as const, lat: 47.6626, lng: -122.2984, address: "2623 NE University Village St", city: "Seattle", state: "WA", zip: "98105", externalId: "gs-3310" },
    // Dallas
    { retailerId: "r-target", name: "Target Uptown Dallas", type: "store" as const, lat: 32.8035, lng: -96.8005, address: "3535 Travis St", city: "Dallas", state: "TX", zip: "75204", externalId: "t-1805" },
    { retailerId: "r-walmart", name: "Walmart Supercenter Plano", type: "store" as const, lat: 33.0198, lng: -96.6989, address: "425 Coit Rd", city: "Plano", state: "TX", zip: "75075", externalId: "w-531" },
    { retailerId: "r-vending", name: "Pokémon Vending — Kroger Dallas", type: "vending" as const, lat: 32.8610, lng: -96.7705, address: "5809 Preston Rd", city: "Dallas", state: "TX", zip: "75205", externalId: "v-dal-01" },
    { retailerId: "r-gamestop", name: "GameStop Mockingbird", type: "store" as const, lat: 32.8373, lng: -96.7750, address: "5500 Greenville Ave", city: "Dallas", state: "TX", zip: "75206", externalId: "gs-2201" },
    // Atlanta
    { retailerId: "r-target", name: "Target Midtown Atlanta", type: "store" as const, lat: 33.7863, lng: -84.3810, address: "375 14th St NW", city: "Atlanta", state: "GA", zip: "30318", externalId: "t-1189" },
    { retailerId: "r-walmart", name: "Walmart Supercenter Decatur", type: "store" as const, lat: 33.7751, lng: -84.2945, address: "2525 Memorial Dr", city: "Decatur", state: "GA", zip: "30032", externalId: "w-1124" },
    { retailerId: "r-vending", name: "Pokémon Vending — Publix Midtown", type: "vending" as const, lat: 33.7840, lng: -84.3790, address: "1025 Lenox Rd NE", city: "Atlanta", state: "GA", zip: "30324", externalId: "v-atl-01" },
    // Online hubs (shown as retailer HQ pins for online stock)
    { retailerId: "r-pokemon-center", name: "Pokémon Center Online", type: "online" as const, lat: 47.6062, lng: -122.3321, address: "Online fulfillment", city: "Bellevue", state: "WA", zip: "98004", externalId: "pc-online" },
    { retailerId: "r-target", name: "Target.com Fulfillment (West)", type: "online" as const, lat: 33.8366, lng: -117.9143, address: "Online", city: "Riverside", state: "CA", zip: "92501", externalId: "t-online-west" },
    { retailerId: "r-walmart", name: "Walmart.com Fulfillment (TX)", type: "online" as const, lat: 36.3729, lng: -94.2088, address: "Online", city: "Bentonville", state: "AR", zip: "72712", externalId: "w-online" },
    { retailerId: "r-amazon", name: "Amazon.com Online", type: "online" as const, lat: 47.6225, lng: -122.3370, address: "Online", city: "Seattle", state: "WA", zip: "98109", externalId: "amz-online" },
    { retailerId: "r-best-buy", name: "BestBuy.com Online", type: "online" as const, lat: 44.8625, lng: -93.2914, address: "Online", city: "Richfield", state: "MN", zip: "55423", externalId: "bb-online" },
    { retailerId: "r-gamestop", name: "GameStop.com Online", type: "online" as const, lat: 32.9483, lng: -96.7297, address: "Online", city: "Grapevine", state: "TX", zip: "76051", externalId: "gs-online" },
  ];

  return stores.map((s, i) => ({
    id: `loc-${String(i + 1).padStart(3, "0")}`,
    ...s,
  }));
}

export function createEmptyStore(): AppStore {
  const locations = buildSeedLocations();
  const now = Date.now();
  return {
    retailers: RETAILERS,
    locations,
    products: PRODUCTS,
    snapshots: [],
    reports: [
      {
        id: "rep-demo-1",
        locationId: locations.find((l) => l.externalId === "v-la-01")?.id || locations[0].id,
        productId: "p-prismatic-etb",
        status: "out",
        note: "Machine empty after weekend rush",
        reporterLabel: "Demo",
        createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "rep-demo-2",
        locationId: locations.find((l) => l.externalId === "t-329")?.id || locations[0].id,
        productId: "p-sv8-etb",
        status: "limited",
        note: "Two ETBs left on endcap",
        reporterLabel: "Demo",
        createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
      },
    ],
    webSignals: [],
    sets: [],
    cards: [],
    meta: {
      pricesSyncedAt: null,
      stockPolledAt: null,
      webSignalsSyncedAt: null,
    },
  };
}
