import type { DiagnosticCheck, DiagnosticStatus, TestingConsoleSnapshot } from "@/types/testing";
import { baselineTestingConsoleSnapshot } from "./mockTestingData";
import { getVideoFallbackPolicy } from "@/services/video";
import { isDailyConfigured, isDailyFallbackEnabled, isResendConfigured } from "@/lib/env";
import { getD1 } from "@/lib/d1/binding";


function buildRuntimeSmokeChecks(): DiagnosticCheck[] {
  const dailyReady = isDailyConfigured();
  const dailyEnabled = isDailyFallbackEnabled();
  const resendReady = isResendConfigured();
  const databaseReady = Boolean(getD1());

  return [
    {
      id: "runtime-daily-config",
      label: "Daily automatic fallback setting",
      description: "Checks Daily server-side API key, domain, base URL, and backend fallback toggle.",
      status: dailyReady && dailyEnabled ? "pass" : dailyReady ? "warn" : "fail",
      severity: "critical",
      recommendedAction: dailyReady && dailyEnabled
        ? "Daily automatic fallback is ready and does not require producer approval."
        : dailyReady
          ? "Set DAILY_FALLBACK_ENABLED=true to activate automatic Daily fallback."
          : "Set DAILY_API_KEY, DAILY_API_BASE_URL, DAILY_DOMAIN, and DAILY_FALLBACK_ENABLED=true.",
      metadata: { dailyReady, dailyEnabled },
    },
    {
      id: "runtime-resend-config",
      label: "Resend sender readiness",
      description: "Checks production email credentials and sender identity are configured.",
      status: resendReady ? "pass" : "fail",
      severity: "critical",
      recommendedAction: resendReady ? "Run send smoke after deploy." : "Set RESEND_API_KEY and EMAIL_FROM.",
      metadata: { resendReady },
    },
    {
      id: "runtime-d1-binding",
      label: "D1 write/read readiness",
      description: "Checks service-role configuration needed for server-side read/write smoke tests.",
      status: databaseReady ? "pass" : "fail",
      severity: "critical",
      recommendedAction: databaseReady ? "Run write/read smoke after deploy." : "Bind the D1 database as DB in wrangler.jsonc.",
      metadata: { databaseReady },
    },
  ];
}

function rankStatus(status: DiagnosticStatus) {
  const ranks: Record<DiagnosticStatus, number> = {
    pass: 0,
    skipped: 1,
    pending: 2,
    warn: 3,
    fail: 4,
  };

  return ranks[status];
}

export function getTestingConsoleSnapshot(eventId: string): TestingConsoleSnapshot {
  const policy = getVideoFallbackPolicy();
  const runtimeSmokeChecks = buildRuntimeSmokeChecks();
  const snapshot = {
    ...baselineTestingConsoleSnapshot,
    eventId,
    generatedAt: new Date().toISOString(),
    fallbackOrder: policy.order,
    dailyAutomaticFallbackEnabled: policy.dailyAutomaticFallbackEnabled,
    smokeChecks: [...baselineTestingConsoleSnapshot.smokeChecks, ...runtimeSmokeChecks],
    rooms: baselineTestingConsoleSnapshot.rooms.map((room) => ({ ...room, eventId })),
    incidents: baselineTestingConsoleSnapshot.incidents.map((incident) => ({ ...incident, eventId })),
  };

  const allStatuses = [
    ...snapshot.checks.map((check) => check.status),
    ...snapshot.devices.map((device) => device.status),
    ...snapshot.rooms.map((room) => room.status),
    ...snapshot.smokeChecks.map((check) => check.status),
  ];

  const worst = allStatuses.sort((a, b) => rankStatus(b) - rankStatus(a))[0] || "pending";

  const criticalIncident = snapshot.incidents.some((incident) => incident.status === "open" && incident.platformRecoveryRequired);

  return {
    ...snapshot,
    overallStatus: worst,
    goNoGo: criticalIncident || worst === "fail" ? "no_go" : worst === "warn" || worst === "pending" ? "monitor" : "go",
    recoveryMode: criticalIncident ? "producer_intervention" : "none",
    whiteLabelBackupEnabled: snapshot.whiteLabelBackupEnabled,
    whiteLabelBackupProvider: snapshot.whiteLabelBackupProvider,
    whiteLabelBackupLabel: snapshot.whiteLabelBackupLabel,
    whiteLabelBackupUrl: snapshot.whiteLabelBackupUrl,
    fallbackOrder: snapshot.fallbackOrder,
    dailyAutomaticFallbackEnabled: snapshot.dailyAutomaticFallbackEnabled,
    smokeChecks: snapshot.smokeChecks,
  };
}

export function requiresProducerRecovery(snapshot: TestingConsoleSnapshot) {
  return snapshot.goNoGo === "no_go" || snapshot.incidents.some((incident) => incident.platformRecoveryRequired && incident.status === "open");
}
