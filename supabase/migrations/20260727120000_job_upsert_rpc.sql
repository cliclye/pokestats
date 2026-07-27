-- Secure job writes without exposing service_role to the client.
-- Jobs authenticate with JOBS_SECRET via verify_jobs_secret / job_upsert_json.

create schema if not exists private;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null
);

revoke all on schema private from public;
revoke all on private.app_secrets from public;

create or replace function public.verify_jobs_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists(
    select 1 from private.app_secrets
    where key = 'JOBS_SECRET' and value = p_secret
  );
$$;

revoke all on function public.verify_jobs_secret(text) from public;
grant execute on function public.verify_jobs_secret(text) to anon, authenticated, service_role;

create or replace function public.job_upsert_json(
  p_secret text,
  p_table text,
  p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  if not public.verify_jobs_secret(p_secret) then
    raise exception 'unauthorized';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return 0;
  end if;

  if p_table = 'retailers' then
    insert into retailers(id, slug, name, color)
    select x->>'id', x->>'slug', x->>'name', x->>'color'
    from jsonb_array_elements(p_rows) x
    on conflict (id) do update set slug = excluded.slug, name = excluded.name, color = excluded.color;
  elsif p_table = 'locations' then
    insert into locations(id, retailer_id, name, type, lat, lng, address, city, state, zip, external_id)
    select x->>'id', x->>'retailer_id', x->>'name', x->>'type', (x->>'lat')::float8, (x->>'lng')::float8,
           x->>'address', x->>'city', x->>'state', x->>'zip', x->>'external_id'
    from jsonb_array_elements(p_rows) x
    on conflict (id) do update set
      retailer_id = excluded.retailer_id, name = excluded.name, type = excluded.type,
      lat = excluded.lat, lng = excluded.lng, address = excluded.address,
      city = excluded.city, state = excluded.state, zip = excluded.zip, external_id = excluded.external_id;
  elsif p_table = 'products' then
    insert into products(id, name, set_code, category, image_url, retailer_skus, retailer_urls)
    select x->>'id', x->>'name', x->>'set_code', x->>'category', x->>'image_url',
           coalesce(x->'retailer_skus', '{}'::jsonb), coalesce(x->'retailer_urls', '{}'::jsonb)
    from jsonb_array_elements(p_rows) x
    on conflict (id) do update set
      name = excluded.name, set_code = excluded.set_code, category = excluded.category,
      image_url = excluded.image_url, retailer_skus = excluded.retailer_skus, retailer_urls = excluded.retailer_urls;
  elsif p_table = 'stock_snapshots' then
    insert into stock_snapshots(id, location_id, product_id, retailer_id, status, quantity, source, checked_at, note)
    select x->>'id', nullif(x->>'location_id',''), x->>'product_id', x->>'retailer_id', x->>'status',
           nullif(x->>'quantity','')::int, x->>'source', (x->>'checked_at')::timestamptz, x->>'note'
    from jsonb_array_elements(p_rows) x
    on conflict (id) do update set
      location_id = excluded.location_id, product_id = excluded.product_id, retailer_id = excluded.retailer_id,
      status = excluded.status, quantity = excluded.quantity, source = excluded.source,
      checked_at = excluded.checked_at, note = excluded.note;
  elsif p_table = 'stock_reports' then
    insert into stock_reports(id, location_id, product_id, status, note, reporter_label, created_at)
    select x->>'id', x->>'location_id', nullif(x->>'product_id',''), x->>'status', coalesce(x->>'note',''),
           coalesce(x->>'reporter_label','Anonymous'), coalesce((x->>'created_at')::timestamptz, now())
    from jsonb_array_elements(p_rows) x
    on conflict (id) do nothing;
  elsif p_table = 'web_signals' then
    insert into web_signals(id, source_site, title, url, retailer_slug, product_id, product_name, status, observed_at, raw)
    select x->>'id', x->>'source_site', x->>'title', x->>'url', x->>'retailer_slug', x->>'product_id',
           x->>'product_name', x->>'status', (x->>'observed_at')::timestamptz, coalesce(x->>'raw','')
    from jsonb_array_elements(p_rows) x
    on conflict (id) do update set
      source_site = excluded.source_site, title = excluded.title, url = excluded.url,
      retailer_slug = excluded.retailer_slug, product_id = excluded.product_id,
      product_name = excluded.product_name, status = excluded.status,
      observed_at = excluded.observed_at, raw = excluded.raw;
  elsif p_table = 'card_sets' then
    insert into card_sets(id, name, series, release_date, total, printed_total, image_symbol, image_logo)
    select x->>'id', x->>'name', x->>'series', x->>'release_date', (x->>'total')::int, (x->>'printed_total')::int,
           x->>'image_symbol', x->>'image_logo'
    from jsonb_array_elements(p_rows) x
    on conflict (id) do update set
      name = excluded.name, series = excluded.series, release_date = excluded.release_date,
      total = excluded.total, printed_total = excluded.printed_total,
      image_symbol = excluded.image_symbol, image_logo = excluded.image_logo;
  elsif p_table = 'cards' then
    insert into cards(id, name, number, rarity, set_id, set_name, artist, image_small, image_large, tcgplayer_url, prices, price_updated_at)
    select x->>'id', x->>'name', x->>'number', x->>'rarity', x->>'set_id', x->>'set_name', x->>'artist',
           x->>'image_small', x->>'image_large', x->>'tcgplayer_url', coalesce(x->'prices', '{}'::jsonb),
           nullif(x->>'price_updated_at','')::timestamptz
    from jsonb_array_elements(p_rows) x
    on conflict (id) do update set
      name = excluded.name, number = excluded.number, rarity = excluded.rarity, set_id = excluded.set_id,
      set_name = excluded.set_name, artist = excluded.artist, image_small = excluded.image_small,
      image_large = excluded.image_large, tcgplayer_url = excluded.tcgplayer_url,
      prices = excluded.prices, price_updated_at = excluded.price_updated_at;
  elsif p_table = 'app_meta' then
    insert into app_meta(key, value)
    select x->>'key', x->'value'
    from jsonb_array_elements(p_rows) x
    on conflict (key) do update set value = excluded.value;
  else
    raise exception 'unknown table %', p_table;
  end if;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.job_upsert_json(text, text, jsonb) from public;
grant execute on function public.job_upsert_json(text, text, jsonb) to anon, authenticated, service_role;
