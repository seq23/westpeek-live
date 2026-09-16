-- 0034 · plan an event, end to end (16 Sep 2026)
--
-- /request-event collected a request and nothing happened after that. There was no price, no way
-- for the client to say yes, no record of payment, and no instructions. This migration gives the
-- whole path one row and one list.
--
--   request_event_intake — EXTENDED, not replaced. The row the visitor creates is the row the owner
--     prices, the row the client confirms, and the row that records the settlement. Two tables
--     would have meant two lists that drift apart.
--     * budget_range — the band the visitor picked; required on the form since today;
--     * state — requested | approved | confirmed | paid | declined;
--     * scope_summary / price_amount_cents / price_currency — what was promised and for how much;
--     * confirm_token — the client's unguessable link to their own scope page;
--     * event_id — the draft runtime event this became, so instruction links carry ITS codes;
--     * approved_* / confirmed_* / paid_* / declined_* — who moved it and when;
--     * settlement_method / settlement_reference — 'manual' today (West Peek marks it settled from
--       the workspace); a payment provider writes its own method and its own reference here later
--       WITHOUT any other column changing, which is the point of storing it this way;
--     * instructions_sent_at — when the instruction emails went out. The detail of who got what
--       lives in runtime_email_sends (0032); this is just the fact that it happened.
--
--   how_it_works_pages — the five instruction pages, editable from the workspace. Content lives in
--     the database rather than in the bundle so a correction does not need a deploy. A slug with no
--     row renders the first draft that ships in the code, so the pages are never blank.
--
-- Safe additive migration. Does not enable/alter RLS policies. Idempotent: safe to run twice.

alter table public.request_event_intake add column if not exists budget_range text;
alter table public.request_event_intake add column if not exists state text not null default 'requested';
alter table public.request_event_intake add column if not exists scope_summary text;
alter table public.request_event_intake add column if not exists price_amount_cents bigint;
alter table public.request_event_intake add column if not exists price_currency text;
alter table public.request_event_intake add column if not exists confirm_token text;
alter table public.request_event_intake add column if not exists event_id text;
alter table public.request_event_intake add column if not exists approved_at timestamptz;
alter table public.request_event_intake add column if not exists approved_by text;
alter table public.request_event_intake add column if not exists confirmed_at timestamptz;
alter table public.request_event_intake add column if not exists paid_at timestamptz;
alter table public.request_event_intake add column if not exists paid_by text;
alter table public.request_event_intake add column if not exists settlement_method text;
alter table public.request_event_intake add column if not exists settlement_reference text;
alter table public.request_event_intake add column if not exists instructions_sent_at timestamptz;
alter table public.request_event_intake add column if not exists declined_at timestamptz;
alter table public.request_event_intake add column if not exists decline_reason text;
alter table public.request_event_intake add column if not exists updated_at timestamptz not null default now();

-- The client's link resolves by this column alone, so it has to be unique and it has to be fast.
create unique index if not exists request_event_intake_confirm_token_idx
  on public.request_event_intake(confirm_token)
  where confirm_token is not null;

-- The workspace list is "what is waiting on me", which is a filter on state.
create index if not exists request_event_intake_state_idx
  on public.request_event_intake(state, created_at desc);

create table if not exists public.how_it_works_pages (
  slug text primary key,
  title text not null,
  intro text not null default '',
  body text not null default '',
  updated_by text,
  updated_by_label text,
  updated_at timestamptz not null default now()
);
