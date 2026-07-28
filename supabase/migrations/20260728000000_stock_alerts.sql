-- SMS stock reminder subscriptions (phones never publicly readable)
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.stock_alerts (
  id text primary key,
  phone_e164 text not null,
  set_codes text[] not null default '{}',
  product_ids text[] not null default '{}',
  active boolean not null default true,
  unsubscribe_token text not null unique,
  last_notified_at timestamptz,
  last_notified_fingerprint text,
  created_at timestamptz not null default now()
);

create unique index if not exists stock_alerts_phone_uidx on public.stock_alerts (phone_e164);
create index if not exists stock_alerts_active_idx on public.stock_alerts (active) where active;

alter table public.stock_alerts enable row level security;

revoke all on public.stock_alerts from anon, authenticated;
grant all on public.stock_alerts to service_role;

create or replace function public.subscribe_stock_alert(
  p_phone text,
  p_set_codes text[] default '{}',
  p_product_ids text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id text;
  v_token text;
  v_phone text;
begin
  v_phone := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
  if v_phone ~ '^[0-9]{10}$' then
    v_phone := '+1' || v_phone;
  elsif v_phone ~ '^1[0-9]{10}$' then
    v_phone := '+' || v_phone;
  elsif v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone';
  end if;

  if (coalesce(array_length(p_set_codes, 1), 0) = 0
      and coalesce(array_length(p_product_ids, 1), 0) = 0) then
    raise exception 'need_set_or_product';
  end if;

  if coalesce(array_length(p_set_codes, 1), 0) > 12
     or coalesce(array_length(p_product_ids, 1), 0) > 20 then
    raise exception 'too_many_selections';
  end if;

  v_id := 'alert-' || encode(digest((v_phone || clock_timestamp()::text)::bytea, 'sha256'), 'hex');
  v_token := encode(gen_random_bytes(18), 'hex');

  insert into public.stock_alerts as a (
    id, phone_e164, set_codes, product_ids, active, unsubscribe_token, created_at
  ) values (
    v_id, v_phone,
    coalesce(p_set_codes, '{}'),
    coalesce(p_product_ids, '{}'),
    true, v_token, now()
  )
  on conflict (phone_e164) do update set
    set_codes = excluded.set_codes,
    product_ids = excluded.product_ids,
    active = true,
    unsubscribe_token = excluded.unsubscribe_token,
    last_notified_fingerprint = null
  returning a.id, a.unsubscribe_token into v_id, v_token;

  return jsonb_build_object('id', v_id, 'unsubscribeToken', v_token, 'phone', v_phone);
end;
$$;

revoke all on function public.subscribe_stock_alert(text, text[], text[]) from public;
grant execute on function public.subscribe_stock_alert(text, text[], text[]) to anon, authenticated, service_role;

create or replace function public.unsubscribe_stock_alert(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.stock_alerts
  set active = false
  where unsubscribe_token = p_token;
  return found;
end;
$$;

revoke all on function public.unsubscribe_stock_alert(text) from public;
grant execute on function public.unsubscribe_stock_alert(text) to anon, authenticated, service_role;

create or replace function public.job_list_stock_alerts(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_jobs_secret(p_secret) then
    raise exception 'unauthorized';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'phoneE164', phone_e164,
      'setCodes', set_codes,
      'productIds', product_ids,
      'active', active,
      'unsubscribeToken', unsubscribe_token,
      'lastNotifiedAt', last_notified_at,
      'lastNotifiedFingerprint', last_notified_fingerprint,
      'createdAt', created_at
    ) order by created_at)
    from public.stock_alerts
    where active = true
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.job_list_stock_alerts(text) from public;
grant execute on function public.job_list_stock_alerts(text) to anon, authenticated, service_role;

create or replace function public.job_mark_alert_notified(
  p_secret text,
  p_id text,
  p_fingerprint text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.verify_jobs_secret(p_secret) then
    raise exception 'unauthorized';
  end if;
  update public.stock_alerts
  set last_notified_at = now(),
      last_notified_fingerprint = p_fingerprint
  where id = p_id;
  return found;
end;
$$;

revoke all on function public.job_mark_alert_notified(text, text, text) from public;
grant execute on function public.job_mark_alert_notified(text, text, text) to anon, authenticated, service_role;
