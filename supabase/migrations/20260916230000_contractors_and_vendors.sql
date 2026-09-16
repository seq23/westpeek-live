-- 0033 · real contractors and vendors (16 Sep 2026)
--
-- /app/contractors and /app/vendors rendered compiled seed fixtures: no create, no edit, and no
-- link to any event. Both are now real rows here.
--
-- ONE table, two views. A contractor (a person hired for a role on a show) and a vendor (a company
-- supplying a service) carry identical fields, are attached to events identically and are paid
-- identically; `kind` is the only difference, so two tables would have bought two migrations and
-- two copies of every list for a word.
--
--   suppliers
--     * kind — 'contractor' (a person) or 'vendor' (a company);
--     * name, company, role_or_service — "Technical director", or "Captioning";
--     * email, phone — how to reach them;
--     * rate_kind / rate_amount — a person is hired by the day, a company quotes the job;
--       0 means "not agreed yet" and the app says so rather than showing $0;
--     * status — shortlisted → booked → paid;
--     * archived_at — archiving is the only removal; nothing is hard-deleted.
--
--   supplier_event_links
--     * one supplier on one event, many events per supplier. A link, never a copy: a phone number
--       corrected once is corrected on every show they are on.
--
-- Idempotent: safe to run twice.
create table if not exists public.suppliers (
  id text primary key,
  kind text not null default 'contractor',
  name text not null default '',
  company text not null default '',
  role_or_service text not null default '',
  email text not null default '',
  phone text not null default '',
  rate_kind text not null default 'day_rate',
  rate_amount numeric not null default 0,
  notes text not null default '',
  status text not null default 'shortlisted',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_kind_idx on public.suppliers (kind, created_at desc);
create index if not exists suppliers_status_idx on public.suppliers (status);
create index if not exists suppliers_archived_idx on public.suppliers (archived_at);

create table if not exists public.supplier_event_links (
  id text primary key,
  supplier_id text not null,
  event_id text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- One supplier is on an event once. Attaching twice is the same attachment, not a second row.
create unique index if not exists supplier_event_links_pair_idx on public.supplier_event_links (supplier_id, event_id);
create index if not exists supplier_event_links_event_idx on public.supplier_event_links (event_id, created_at desc);
