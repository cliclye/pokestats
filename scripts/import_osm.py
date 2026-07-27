#!/usr/bin/env python3
"""Nationwide OSM importer via urllib (more reliable connect timeouts than Node undici)."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORE = ROOT / "data" / "store.json"
LOCATIONS = ROOT / "data" / "locations.json"

OVERPASS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
]

UA = "PokeStats/1.0 (python OSM import; polite)"

BRANDS = [
    {
        "slug": "walmart",
        "retailerId": "r-walmart",
        "label": "Walmart",
        "filters": [
            '["brand:wikidata"="Q483551"]',
            '["brand"="Walmart"]',
            '["name"~"^Walmart",i]',
        ],
    },
    {
        "slug": "walmart",
        "retailerId": "r-walmart",
        "label": "Sam's Club",
        "filters": [
            '["brand:wikidata"="Q1970340"]',
            '["brand"="Sam\'s Club"]',
        ],
    },
    {
        "slug": "gamestop",
        "retailerId": "r-gamestop",
        "label": "GameStop",
        "filters": [
            '["brand:wikidata"="Q696140"]',
            '["brand"="GameStop"]',
            '["name"="GameStop"]',
        ],
    },
    {
        "slug": "best-buy",
        "retailerId": "r-best-buy",
        "label": "Best Buy",
        "filters": [
            '["brand:wikidata"="Q533415"]',
            '["brand"="Best Buy"]',
            '["name"="Best Buy"]',
        ],
    },
    {
        "slug": "pokemon-center",
        "retailerId": "r-pokemon-center",
        "label": "Pokémon Center",
        "filters": ['["name"~"Pokémon Center|Pokemon Center",i]'],
    },
]

STATES = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
    "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
    "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]

RETAILERS = [
    {"id": "r-target", "slug": "target", "name": "Target", "color": "#CC0000"},
    {"id": "r-walmart", "slug": "walmart", "name": "Walmart", "color": "#0071CE"},
    {"id": "r-pokemon-center", "slug": "pokemon-center", "name": "Pokémon Center", "color": "#FFCB05"},
    {"id": "r-best-buy", "slug": "best-buy", "name": "Best Buy", "color": "#0046BE"},
    {"id": "r-gamestop", "slug": "gamestop", "name": "GameStop", "color": "#6B8E23"},
    {"id": "r-vending", "slug": "vending", "name": "Pokémon Vending", "color": "#E3350D"},
]


def overpass(query: str) -> list[dict]:
    data = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for url in OVERPASS:
        for attempt in range(3):
            try:
                req = urllib.request.Request(
                    url,
                    data=data,
                    method="POST",
                    headers={
                        "User-Agent": UA,
                        "Content-Type": "application/x-www-form-urlencoded",
                        "Accept": "application/json",
                    },
                )
                with urllib.request.urlopen(req, timeout=120) as resp:
                    payload = json.loads(resp.read().decode())
                    return payload.get("elements", [])
            except Exception as exc:  # noqa: BLE001
                last = exc
                time.sleep(2 * (attempt + 1))
    raise RuntimeError(last)


def classify(tags: dict) -> tuple[str, str, str] | None:
    wiki = tags.get("brand:wikidata", "")
    brand = (tags.get("brand") or "").lower()
    name = (tags.get("name") or "").lower()
    if wiki == "Q1970340" or ("sam" in brand and "club" in brand) or "sam's club" in name:
        return "walmart", "r-walmart", "Sam's Club"
    if wiki == "Q483551" or brand == "walmart" or name.startswith("walmart"):
        return "walmart", "r-walmart", "Walmart"
    if wiki == "Q533415" or brand == "best buy" or name == "best buy":
        return "best-buy", "r-best-buy", "Best Buy"
    if wiki == "Q696140" or brand == "gamestop" or name == "gamestop":
        return "gamestop", "r-gamestop", "GameStop"
    if "pokemon center" in name or "pokémon center" in name:
        return "pokemon-center", "r-pokemon-center", "Pokémon Center"
    if wiki == "Q504614" or brand == "target" or name == "target":
        return "target", "r-target", "Target"
    return None


def el_to_loc(el: dict) -> dict | None:
    lat = el.get("lat") or (el.get("center") or {}).get("lat")
    lng = el.get("lon") or (el.get("center") or {}).get("lon")
    if lat is None or lng is None:
        return None
    tags = el.get("tags") or {}
    meta = classify(tags)
    if not meta:
        return None
    slug, retailer_id, label = meta
    house = tags.get("addr:housenumber", "")
    street = tags.get("addr:street", "")
    address = tags.get("addr:full") or " ".join(x for x in [house, street] if x) or "Address unavailable"
    return {
        "id": f"osm-{slug}-{el['type'][0]}{el['id']}",
        "retailerId": retailer_id,
        "name": tags.get("name") or tags.get("brand") or label,
        "type": "store",
        "lat": lat,
        "lng": lng,
        "address": address,
        "city": tags.get("addr:city", ""),
        "state": tags.get("addr:state", ""),
        "zip": tags.get("addr:postcode", ""),
        "externalId": f"osm-{el['type']}-{el['id']}",
    }


def state_query(state: str, brand: dict) -> str:
    union = "\n".join(f'  nwr{f}(area.s);' for f in brand["filters"])
    return f"""[out:json][timeout:90];
area["ISO3166-2"="US-{state}"][admin_level=4]->.s;
(
{union}
);
out center tags;"""


def load_into() -> dict[str, dict]:
    store = json.loads(STORE.read_text())
    return {loc["id"]: loc for loc in store.get("locations", [])}


def save(into: dict[str, dict]) -> None:
    # dedupe coords
    final: dict[str, dict] = {}
    for loc in into.values():
        key = f"{loc['retailerId']}:{loc['lat']:.4f},{loc['lng']:.4f}"
        final.setdefault(key, loc)
    locations = list(final.values())
    by: dict[str, int] = {}
    names = {r["id"]: r["name"] for r in RETAILERS}
    for loc in locations:
        n = names.get(loc["retailerId"], loc["retailerId"])
        by[n] = by.get(n, 0) + 1

    LOCATIONS.write_text(
        json.dumps(
            {
                "importedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "count": len(locations),
                "byRetailer": by,
                "locations": locations,
            }
        )
    )
    store = json.loads(STORE.read_text())
    store["retailers"] = RETAILERS
    store["locations"] = locations
    tmp = STORE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(store))
    tmp.replace(STORE)
    print("  saved", len(locations), by, flush=True)


def ingest_cached(path: Path, into: dict[str, dict]) -> int:
    if not path.exists():
        return 0
    data = json.loads(path.read_text())
    added = 0
    for el in data.get("elements", []):
        loc = el_to_loc(el)
        if not loc or loc["id"] in into:
            continue
        into[loc["id"]] = loc
        added += 1
    return added


def main() -> None:
    into = load_into()
    print(f"start {len(into)}", flush=True)

    # reuse any cached overpass responses
    for cached in [Path("/tmp/tx_w.json"), Path("/tmp/ca.json")]:
        added = ingest_cached(cached, into)
        print(f"cached {cached.name}: +{added}", flush=True)
    save(into)

    for brand in BRANDS:
        print(f"\n=== {brand['label']} ===", flush=True)
        brand_added = 0
        for i, state in enumerate(STATES, 1):
            try:
                print(f"  {state}…", flush=True)
                els = overpass(state_query(state, brand))
                added = 0
                for el in els:
                    loc = el_to_loc(el)
                    if not loc or loc["id"] in into:
                        continue
                    into[loc["id"]] = loc
                    added += 1
                    brand_added += 1
                print(
                    f"  {state}: +{added} (brand {brand_added}, total {len(into)}) [{i}/{len(STATES)}]",
                    flush=True,
                )
            except Exception as exc:  # noqa: BLE001
                print(f"  {state} failed: {exc}", flush=True)
            time.sleep(1.0)
            if i % 5 == 0:
                save(into)
        save(into)

    print("done", flush=True)


if __name__ == "__main__":
    main()
