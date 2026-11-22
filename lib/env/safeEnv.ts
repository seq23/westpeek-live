import registry from '@/deployment/env-var-registry.json';

const demoDefaults = registry.demoDefaults as Record<string, string | undefined>;

export function day1AccessDefault(key: string, fallback = '') {
  return process.env[key] || demoDefaults[key] || fallback;
}

export function requiredDay1AccessDefault(key: string) {
  const value = day1AccessDefault(key);
  if (!value) throw new Error(`Missing day1 demoDefault for ${key}`);
  return value;
}

export const DAY1_CREW_PASSWORD = requiredDay1AccessDefault('CREW_ACCESS_PASSWORD');
export const DAY1_OPERATOR_PASSWORD = requiredDay1AccessDefault('OPERATOR_LAUNCHPAD_PASSWORD');
export const DAY1_SPEAKER_PASSWORD = requiredDay1AccessDefault('EVENT_DEMO_SPEAKER_CODE');
export const DAY1_SPONSOR_PASSWORD = requiredDay1AccessDefault('EVENT_DEMO_SPONSOR_CODE');
export const DAY1_VIP_PASSWORD = requiredDay1AccessDefault('EVENT_DEMO_VIP_CODE');

export function missingAccessEnv() {
  const missing: string[] = [];
  if (!process.env.CREW_ACCESS_PASSWORD) missing.push('CREW_ACCESS_PASSWORD');
  if (!process.env.OPERATOR_LAUNCHPAD_PASSWORD) missing.push('OPERATOR_LAUNCHPAD_PASSWORD');
  if (!process.env.V5_ACCESS_COOKIE_SECRET) missing.push('V5_ACCESS_COOKIE_SECRET');
  return missing;
}

export function accessDefaultLines() {
  return [
    `CREW_ACCESS_PASSWORD=${DAY1_CREW_PASSWORD}`,
    `OPERATOR_LAUNCHPAD_PASSWORD=${DAY1_OPERATOR_PASSWORD}`,
    `EVENT_DEMO_SPEAKER_CODE=${DAY1_SPEAKER_PASSWORD}`,
    `EVENT_DEMO_SPONSOR_CODE=${DAY1_SPONSOR_PASSWORD}`,
    `EVENT_DEMO_VIP_CODE=${DAY1_VIP_PASSWORD}`,
    'V5_ACCESS_COOKIE_SECRET=<32+ character internal cookie secret>',
  ];
}

export function safeAccessCookieNames() {
  return {
    crewCookieName: process.env.V5_CREW_COOKIE_NAME || 'wpl_crew_access',
    specialGuestCookieName: process.env.V5_SPECIAL_GUEST_COOKIE_NAME || 'wpl_guest_access',
    operatorCookieName: process.env.V5_OPERATOR_COOKIE_NAME || 'wpl_operator_access',
    ownerCookieName: process.env.V5_OWNER_COOKIE_NAME || 'wpl_owner_access',
  };
}
