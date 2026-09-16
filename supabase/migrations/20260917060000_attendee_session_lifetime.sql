-- 0039 · how long a registration lasts on one device, per event (17 Sep 2026)
--
-- The owner, after attending her own show from a phone: "what if i registered already and was out,
-- do i have to register again when i come back, how long does my registration last if i exit? both
-- on mobile and desktop?" Nothing answered her, because the answer was a magic number in a service
-- file (SESSION_DAYS = 14) that neither the product nor the owner could see or change.
--
--   runtime_events.attendee_session_days — how many days an attendee session lasts on one browser
--     for THIS event. Null means the platform default (14), so nothing changes for existing events.
--     The venue copy reads the resolved value instead of printing "14" in a sentence.
--
-- Registration itself is per event and per browser and stays that way: the session cookie is the
-- device. A second device is handled by the same-email return path, not by widening this cookie.
--
-- Safe additive migration; no RLS changes. Mirrored byte-for-byte under supabase/migrations/.

alter table public.runtime_events add column if not exists attendee_session_days integer;
