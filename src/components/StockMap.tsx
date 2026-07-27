"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type Map as MaplibreMap,
  type MapLayerMouseEvent,
  type GeoJSONSource,
} from "maplibre-gl";
import type { StockStatus, TrackedProduct, Retailer, WebStockSignal } from "@/lib/types";
import { ReportForm } from "./ReportForm";
import { RestockFeed } from "./RestockFeed";

/** MapLibre v6 bundlers need an explicit same-origin worker URL. */
setWorkerUrl("/maplibre-gl-worker.mjs");

type PendingGeo = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }>;
};

interface FeatureProps {
  id: string;
  name: string;
  retailer: string;
  retailerSlug: string;
  retailerColor: string;
  type: string;
  status: StockStatus;
  color: string;
  source: string;
  freshness: string;
  confidence: number;
  address: string;
  city: string;
  state: string;
}

interface SelectedLocation {
  id: string;
  name: string;
  retailer: string;
  type: string;
  status: StockStatus;
  freshness: string;
  confidence: number;
  address: string;
}

const INTERACTIVE_LAYERS = ["clusters", "cluster-count", "unclustered"] as const;

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

function toFeatureCollection(geojson: {
  type?: string;
  features?: PendingGeo["features"];
}): PendingGeo {
  return {
    type: "FeatureCollection",
    features: Array.isArray(geojson.features) ? geojson.features : [],
  };
}

export function StockMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MaplibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [count, setCount] = useState(0);
  const [products, setProducts] = useState<TrackedProduct[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [meta, setMeta] = useState<{
    stockPolledAt: string | null;
    webSignalsSyncedAt: string | null;
  } | null>(null);
  const [signals, setSignals] = useState<WebStockSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [retailer, setRetailer] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selected, setSelected] = useState<SelectedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (productId) p.set("productId", productId);
    if (retailer) p.set("retailer", retailer);
    if (inStockOnly) p.set("inStock", "1");
    return p.toString();
  }, [productId, retailer, inStockOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stock/geojson?${query}`);
      if (!res.ok) throw new Error("Failed to load stock map");
      const geojson = await res.json();
      const collection = toFeatureCollection(geojson);
      setCount(geojson.meta?.count ?? collection.features.length);
      setProducts(geojson.meta?.products || []);
      setRetailers(geojson.meta?.retailers || []);
      setMeta({
        stockPolledAt: geojson.meta?.stockPolledAt ?? null,
        webSignalsSyncedAt: geojson.meta?.webSignalsSyncedAt ?? null,
      });
      setSignals(geojson.meta?.recentSignals || []);

      const map = mapInstance.current;
      if (map && map.getSource("locations")) {
        (map.getSource("locations") as GeoJSONSource).setData(collection);
      } else if (map) {
        (map as MaplibreMap & { __pendingGeo?: PendingGeo }).__pendingGeo = collection;
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const kickoff = setTimeout(() => void load(), 0);
    const id = setInterval(() => void load(), 60_000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const container = mapRef.current;

    const map = new Map({
      container,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap © CARTO",
          },
        },
        layers: [{ id: "carto", type: "raster", source: "carto" }],
      },
      center: [-98.5, 39.5],
      zoom: 3.6,
      attributionControl: {},
    });

    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    const resize = () => map.resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(container);

    const setupLayers = () => {
      if (map.getSource("locations")) return;

      map.addSource("locations", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 50,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "locations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#5cffb0",
          "circle-radius": ["step", ["get", "point_count"], 16, 25, 22, 100, 30, 750, 38],
          "circle-opacity": 0.85,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#04110c",
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "locations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
        },
        paint: {
          "text-color": "#04110c",
        },
      });

      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "locations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": 7,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#04110c",
          "circle-opacity": 0.95,
        },
      });

      const pending = (map as MaplibreMap & { __pendingGeo?: PendingGeo }).__pendingGeo;
      if (pending) {
        (map.getSource("locations") as GeoJSONSource).setData(pending);
      }

      resize();
      setMapReady(true);
    };

    if (map.isStyleLoaded()) setupLayers();
    else map.on("load", setupLayers);

    const expandCluster = async (e: MapLayerMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["clusters", "cluster-count"],
      });
      const clusterId = Number(features[0]?.properties?.cluster_id);
      const source = map.getSource("locations") as GeoJSONSource;
      if (!Number.isFinite(clusterId)) return;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      const geometry = features[0].geometry;
      if (geometry.type !== "Point") return;
      map.easeTo({
        center: geometry.coordinates as [number, number],
        zoom,
      });
    };

    const openPin = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (!f || f.geometry.type !== "Point") return;
      const raw = (f.properties ?? {}) as Record<string, unknown>;
      const p = raw as unknown as FeatureProps;
      setSelected({
        id: String(p.id ?? ""),
        name: String(p.name ?? ""),
        retailer: String(p.retailer ?? ""),
        type: String(p.type ?? ""),
        status: p.status,
        freshness: String(p.freshness ?? ""),
        confidence: Number(p.confidence),
        address: String(p.address ?? ""),
      });
      map.flyTo({
        center: f.geometry.coordinates as [number, number],
        zoom: Math.max(map.getZoom(), 11),
        essential: true,
      });

      popupRef.current?.remove();
      popupRef.current = new Popup({ offset: 12, closeButton: false })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setHTML(
          `<strong>${String(p.name ?? "")}</strong><br/><span style="opacity:.75">${String(p.retailer ?? "")} · ${statusLabel(p.status)}</span>`,
        )
        .addTo(map);
    };

    // cluster-count sits on top of clusters — both must expand on click
    map.on("click", "clusters", (e) => {
      void expandCluster(e);
    });
    map.on("click", "cluster-count", (e) => {
      void expandCluster(e);
    });
    map.on("click", "unclustered", openPin);

    for (const layer of INTERACTIVE_LAYERS) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    requestAnimationFrame(resize);
    const t1 = setTimeout(resize, 50);
    const t2 = setTimeout(resize, 250);
    mapInstance.current = map;

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapInstance.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    if (mapReady) void load();
  }, [mapReady, load]);

  return (
    <div className="relative min-h-0 w-full flex-1 overflow-hidden">
      <div ref={mapRef} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-3 md:p-4 md:pr-[22rem]">
        <div className="pointer-events-auto panel animate-rise flex flex-wrap items-center gap-2 rounded-2xl p-3">
          <select
            className="rounded-xl border border-[var(--stroke)] bg-[var(--ink-2)] px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-[var(--stroke)] bg-[var(--ink-2)] px-3 py-2 text-sm"
            value={retailer}
            onChange={(e) => setRetailer(e.target.value)}
          >
            <option value="">All retailers</option>
            {retailers.map((r) => (
              <option key={r.id} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--fog)]/90">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
            />
            In stock only
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--electric)] hover:bg-[rgba(92,255,176,0.08)]"
          >
            Refresh
          </button>
          <span className="rounded-full bg-[rgba(92,255,176,0.12)] px-3 py-1.5 text-xs font-semibold text-[var(--electric)]">
            {count.toLocaleString()} locations
          </span>
          {loading && <span className="text-xs text-[var(--muted)]">Updating…</span>}
        </div>
        <p className="pointer-events-none max-w-2xl text-xs text-[var(--muted)]">
          Nationwide Target, Walmart, Best Buy, GameStop, Amazon, Pokémon Center, and vending pins.
          Stock colors update from retailer polls + scraped NowInStock / public restock posts.
          {meta?.stockPolledAt
            ? ` Last stock poll: ${new Date(meta.stockPolledAt).toLocaleString()}.`
            : ""}
        </p>
        <RestockFeed signals={signals} syncedAt={meta?.webSignalsSyncedAt ?? null} />
      </div>

      <aside
        className={`panel absolute bottom-0 right-0 top-auto z-20 flex max-h-[55%] w-full flex-col overflow-hidden rounded-t-2xl transition-transform duration-300 md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-80 md:rounded-2xl ${
          selected
            ? "pointer-events-auto translate-y-0"
            : "pointer-events-none translate-y-[70%] md:pointer-events-auto md:translate-y-0"
        }`}
      >
        {selected ? (
          <div className="pointer-events-auto flex h-full flex-col overflow-y-auto p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  {selected.retailer} · {selected.type}
                </p>
                <h2 className="font-display text-xl text-[var(--fog)]">{selected.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{selected.address}</p>
              </div>
              <button
                type="button"
                className="text-[var(--muted)] hover:text-[var(--fog)]"
                onClick={() => {
                  setSelected(null);
                  popupRef.current?.remove();
                  popupRef.current = null;
                }}
              >
                ✕
              </button>
            </div>

            <div className="mb-4 flex items-center gap-3 rounded-xl border border-[var(--stroke)] p-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background:
                    selected.status === "in_stock"
                      ? "#22c55e"
                      : selected.status === "limited"
                        ? "#eab308"
                        : selected.status === "out"
                          ? "#ef4444"
                          : "#64748b",
                }}
              />
              <div>
                <p className="text-sm font-semibold">{statusLabel(selected.status)}</p>
                <p className="text-xs text-[var(--muted)]">{selected.freshness}</p>
                <p className="text-xs text-[var(--muted)]">
                  Confidence {(selected.confidence * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            <ReportForm
              locationId={selected.id}
              products={products}
              onSubmitted={() => void load()}
            />
          </div>
        ) : (
          <div className="hidden p-4 md:block">
            <h2 className="font-display text-lg">Location detail</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Tap a pin (or zoom into a green cluster) to inspect stock source and file a check-in.
            </p>
            <div className="mt-4 space-y-2 text-xs text-[var(--muted)]">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" /> In stock
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" /> Limited
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> Out
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#64748b]" /> Unknown
              </div>
            </div>
            <p className="mt-4 text-sm font-semibold text-[var(--electric)]">
              {count.toLocaleString()} locations on map
            </p>
            {error && <p className="mt-3 text-sm text-[var(--coral)]">{error}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}
