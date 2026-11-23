-- 0009_request_event_caps: the public /request-event form is capped per day (23 Nov 2026).
-- Additive only. Rows saved before this migration have neither column and count toward the global
-- day total only.
--   request_event_intake.requester_ip_hash  sha256 of the sender's address, never the address:
--     the per-address daily cap counts these
--   request_event_intake.bot_check  'passed' (Turnstile vouched for it) or 'unchecked' (no token
--     came back, e.g. an ad blocker ate the widget): unchecked requests have their own, tighter cap
ALTER TABLE request_event_intake ADD COLUMN requester_ip_hash TEXT;
ALTER TABLE request_event_intake ADD COLUMN bot_check TEXT CHECK (bot_check IS NULL OR bot_check IN ('passed', 'unchecked'));
CREATE INDEX IF NOT EXISTS request_event_intake_ip_created_idx ON request_event_intake (requester_ip_hash, created_at);
