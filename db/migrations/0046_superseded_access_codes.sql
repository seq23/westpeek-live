-- 0046 · what a code used to be, so an old link can still say something useful (17 Sep 2026)
--
-- Somebody pressed "Adopt the readable codes" on the 45 minute AI workshop. The product did exactly
-- what it promised: the confirm warned that links already handed out would stop working, and its
-- event code went from WPL-GE43TU to WPL-45MINU. The person who then followed the link Scooter had
-- already sent was told "That code did not match an event. Check it against your invitation" — the
-- same sentence a typo or an invented code gets. They could not tell that the event existed, that
-- the code had moved, or what to do about it. For an event that has ended that is bad; mid-show,
-- with an audience holding a week-old invitation, it is the show. The owner rotates codes yearly by
-- design, so this was going to keep happening.
--
-- Nothing in the system remembered a previous code. joinCodeCandidates only forgives the way a
-- phone mangles what somebody typed; once a code was replaced the old value was gone.
--
--   event_code_history — one row per code that was replaced, for any of the six fields.
--     * event_id + field — whose code it was, and which one ('join' is the attendee event code).
--     * code — the old value in its stored form, kept readable so the owner recognises it in the
--       Owner Console. This is a dead credential by definition; it opens nothing.
--     * code_key — the same value flattened (uppercase, letters and digits only) and indexed. Every
--       way a phone mangles a code collapses to this, which is what the lookup matches on.
--     * replaced_at, replaced_by, reason — when, which ROLE did it (never a person's name), and
--       whether it was 'adopt', 'rotate' or a hand-set 'custom' code.
--
-- Two different answers come out of this table and the difference is the entire point. An old
-- ATTENDEE event code lands the person on the event they were invited to with a line saying the
-- code changed — they hold a valid invitation and the change was ours. An old PRIVILEGED code
-- (crew, speaker, sponsor, client, VIP) is refused, because ending somebody's access is the reason
-- to rotate one; it is refused informatively rather than generically, naming the day it changed and
-- who to ask. Rows are honoured for 90 days after replacement (SUPERSEDED_CODE_WINDOW_DAYS in
-- types/supersededCode.ts), which is long enough for an invitation sent a season ahead and short
-- enough that last year's crew code is not still explaining itself when this year's event runs.
--
-- Idempotent: safe to run twice.
create table if not exists public.event_code_history (
  id text primary key,
  event_id text not null,
  field text not null,
  code text not null,
  code_key text not null,
  replaced_at timestamptz not null default now(),
  replaced_by text,
  reason text not null default 'rotate'
);

create index if not exists event_code_history_code_key_idx on public.event_code_history (code_key);
create index if not exists event_code_history_event_idx on public.event_code_history (event_id, field);

-- The one real event this was found on. Scooter had already sent the WPL-GE43TU link when the codes
-- were adopted, so that link has been dead since. Backfilling it here is what makes it work again —
-- the only history row nothing in the app could have written, because the change predates the table.
-- Guarded on the event actually being there, so this is a no-op on a fresh or local database, and
-- on the row not already existing, so re-running changes nothing.
insert into public.event_code_history (id, event_id, field, code, code_key, replaced_at, replaced_by, reason)
select 'code-history-45-minute-ai-workshop-join-ge43tu', runtime_events.id, 'join', 'wpl-ge43tu', 'WPLGE43TU', timestamptz '2026-09-16 00:00:00+00', 'owner', 'adopt'
from public.runtime_events
where runtime_events.slug = '45-minute-ai-workshop'
  and not exists (
    select 1 from public.event_code_history
    where event_code_history.id = 'code-history-45-minute-ai-workshop-join-ge43tu'
  );
