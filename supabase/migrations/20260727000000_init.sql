-- PokeStats schema (apply in Supabase SQL editor or via CLI)
-- Free-tier friendly. RLS: public read, insert reports only.

create extension if not exists "pgcrypto";

create table if not exists retailers (
  id text primary key,
  slug text unique not null,
  name text not null,
  color text not null
);

create table if not exists locations (
  id text primary key,
  retailer_id text references retailers(id),
  name text not null,
  type text not null check (type in ('store', 'vending', 'online')),
  lat double precision not null,
  lng double precision not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  external_id text
);

create table if not exists products (
  id text primary key,
  name text not null,
  set_code text not null,
  category text not null,
  image_url text,
  retailer_skus jsonb not null default '{}',
  retailer_urls jsonb not null default '{}'
);

create table if not exists stock_snapshots (
  id text primary key,
  location_id text,
  product_id text,
  retailer_id text references retailers(id),
  status text not null check (status in ('in_stock', 'out', 'limited', 'unknown')),
  quantity integer,
  source text not null,
  checked_at timestamptz not null,
  note text
);

create index if not exists stock_snapshots_location_idx on stock_snapshots(location_id, checked_at desc);
create index if not exists stock_snapshots_product_idx on stock_snapshots(product_id, checked_at desc);

create table if not exists stock_reports (
  id text primary key,
  location_id text references locations(id) not null,
  product_id text,
  status text not null check (status in ('in_stock', 'out', 'limited', 'unknown')),
  note text not null default '',
  reporter_label text not null default 'Anonymous',
  created_at timestamptz not null default now()
);

create index if not exists stock_reports_location_idx on stock_reports(location_id, created_at desc);

create table if not exists web_signals (
  id text primary key,
  source_site text not null,
  title text not null,
  url text,
  retailer_slug text,
  product_id text,
  product_name text not null,
  status text not null check (status in ('in_stock', 'out', 'limited', 'unknown')),
  observed_at timestamptz not null,
  raw text not null default ''
);

create index if not exists web_signals_observed_idx on web_signals(observed_at desc);

create table if not exists app_meta (
  key text primary key,
  value jsonb
);

create table if not exists card_sets (
  id text primary key,
  name text not null,
  series text not null,
  release_date text not null,
  total integer not null,
  printed_total integer not null,
  image_symbol text,
  image_logo text
);

create table if not exists cards (
  id text primary key,
  name text not null,
  number text not null,
  rarity text,
  set_id text references card_sets(id),
  set_name text not null,
  artist text,
  image_small text,
  image_large text,
  tcgplayer_url text,
  prices jsonb not null default '{}',
  price_updated_at timestamptz
);

create index if not exists cards_name_idx on cards using gin (to_tsvector('english', name));
create index if not exists cards_set_idx on cards(set_id);

alter table retailers enable row level security;
alter table locations enable row level security;
alter table products enable row level security;
alter table stock_snapshots enable row level security;
alter table stock_reports enable row level security;
alter table web_signals enable row level security;
alter table app_meta enable row level security;
alter table card_sets enable row level security;
alter table cards enable row level security;

drop policy if exists "public read retailers" on retailers;
drop policy if exists "public read locations" on locations;
drop policy if exists "public read products" on products;
drop policy if exists "public read snapshots" on stock_snapshots;
drop policy if exists "public read reports" on stock_reports;
drop policy if exists "public insert reports" on stock_reports;
drop policy if exists "public read signals" on web_signals;
drop policy if exists "public read meta" on app_meta;
drop policy if exists "public read sets" on card_sets;
drop policy if exists "public read cards" on cards;

create policy "public read retailers" on retailers for select using (true);
create policy "public read locations" on locations for select using (true);
create policy "public read products" on products for select using (true);
create policy "public read snapshots" on stock_snapshots for select using (true);
create policy "public read reports" on stock_reports for select using (true);
create policy "public insert reports" on stock_reports for insert with check (true);
create policy "public read signals" on web_signals for select using (true);
create policy "public read meta" on app_meta for select using (true);
create policy "public read sets" on card_sets for select using (true);
create policy "public read cards" on cards for select using (true);
