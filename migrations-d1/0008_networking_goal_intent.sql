-- 0008_networking_goal_intent: networking goals read as intent at save time (22 Nov 2026).
-- Additive only. Rows saved before this migration have no stored intent and are read by keywords at
-- match time, as every row was before.
--   attendee_profiles.networking_goal_intent  JSON {intents, source, goalHash, readAt, fallback?}:
--     what the matcher reads, and which goal text (by hash) it was read from
--   ai_usage_monthly  model spend per feature per calendar month (UTC), in neurons, so a feature
--     stops calling the model at its monthly cap and falls back by itself
ALTER TABLE attendee_profiles ADD COLUMN networking_goal_intent TEXT CHECK (json_valid(networking_goal_intent));
CREATE TABLE IF NOT EXISTS ai_usage_monthly (
  feature TEXT NOT NULL,
  month TEXT NOT NULL,
  neurons REAL NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  PRIMARY KEY (feature, month)
);
