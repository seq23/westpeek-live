#!/usr/bin/env node
const fs = require("fs");

function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function valueFor(name) {
  if (process.env[name]) return process.env[name];

  const backupPath = process.env.AGENCY_EVENT_OS_ENV_BACKUP || "/Users/sequoiataylor/agency-event-os.env.local.backup";
  const backup = parseEnvFile(backupPath);
  return backup[name] || "";
}

async function checkColumn(baseUrl, serviceRoleKey, table, column) {
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(column)}&limit=0`;
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      accept: "application/json"
    }
  });

  if (!response.ok) {
    let body = "";
    try { body = await response.text(); } catch {}
    return { ok: false, status: response.status, body };
  }

  return { ok: true, status: response.status };
}

const requiredColumns = {
  stage_stream_states: ["event_id", "stage_id", "state", "updated_at"],
  stage_stream_events: ["id", "event_id", "stage_id", "signal", "state_event", "created_at"],
  live_chat_messages: ["id", "event_id", "room_kind", "room_id", "attendee_id", "display_name", "company", "message", "moderation_status", "moderated_by", "moderated_at", "archived_at", "archived_by", "created_at"],
  live_chat_moderation_states: ["key", "event_id", "room_kind", "room_id", "scope", "attendee_id", "state", "updated_at"],
  live_chat_post_rates: ["key", "event_id", "attendee_id", "state", "updated_at"],
  special_guest_profiles: ["guest_id", "event_id", "role", "name", "company", "title", "created_at", "updated_at"],
  event_guest_states: ["key", "event_id", "kind", "guest_id", "state", "updated_at"],
  networking_queue_entries: ["id", "event_id", "attendee_id", "display_name", "company", "title", "status", "joined_at", "matched_at", "match_id", "matches_completed", "updated_at"],
  networking_queue_matches: ["id", "event_id", "attendee_a_id", "attendee_b_id", "normalized_pair_key", "room_name", "status", "starts_at", "expires_at", "ended_at", "ended_reason"],
  attendee_live_capabilities: ["key", "event_id", "room_kind", "room_id", "attendee_id", "capability", "updated_at"],
  attendee_live_control_states: ["key", "event_id", "room_kind", "room_id", "state", "updated_at"],
  attendee_profiles: ["attendee_id", "event_id", "email_hash", "name", "email_masked", "company", "title", "personal_website", "social_links", "reason_for_attending", "interesting_fact", "topics_of_interest", "networking_goals", "networking_opt_in", "hidden_from_directory", "email", "extra_answers", "role", "status", "created_at", "updated_at"],
  contacts: ["email", "name", "company", "title", "personal_website", "social_links", "topics_of_interest", "networking_goals", "hidden_from_directory", "events_attended", "first_seen_at", "last_seen_at", "updated_at"],
  runtime_events: ["registration_questions"],
  attendee_sessions: ["session_id", "attendee_id", "event_id", "role", "status", "issued_at", "expires_at", "last_seen_at"],
  attendee_agenda_intents: ["id", "attendee_id", "event_id", "planned_session_ids", "planned_breakout_ids", "planned_sponsor_booth_ids", "wants_session_reminders", "updated_at"],
  sponsor_lead_opt_ins: ["id", "attendee_id", "event_id", "sponsor_booth_id", "allowed_fields", "created_at"],
  attendee_permissions: ["id", "attendee_id", "event_id", "permission_kind", "granted", "granted_by", "reason", "updated_at"],
  v6_registration_events: ["display_name", "company", "title", "personal_website", "social_links", "reason_for_attending", "interesting_fact"]
};

async function main() {
  const baseUrl = valueFor("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = valueFor("SUPABASE_SERVICE_ROLE_KEY");

  if (!baseUrl || !serviceRoleKey) {
    console.error("validate_supabase_schema_parity: FAIL — missing Supabase URL or service role key.");
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or keep /Users/sequoiataylor/agency-event-os.env.local.backup available locally.");
    process.exit(1);
  }

  const failures = [];

  for (const [table, columns] of Object.entries(requiredColumns)) {
    for (const column of columns) {
      const result = await checkColumn(baseUrl, serviceRoleKey, table, column);
      if (!result.ok) {
        failures.push({ table, column, status: result.status, body: result.body.slice(0, 240) });
      }
    }
  }

  if (failures.length) {
    console.error("validate_supabase_schema_parity: FAIL — production Supabase schema is missing required queryable tables/columns.");
    for (const failure of failures) {
      console.error(`- ${failure.table}.${failure.column}: HTTP ${failure.status}`);
      if (failure.body) console.error(`  ${failure.body}`);
    }
    process.exit(1);
  }

  console.log("validate_supabase_schema_parity: PASS — required production Supabase tables/columns are queryable.");
  console.log("Secret values were not printed.");
}

main().catch((error) => {
  console.error("validate_supabase_schema_parity: FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
