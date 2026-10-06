"use server";

import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { sendEmail } from "@/services/email/emailService";
import { PasswordAuth } from "./passwordAuth";
import { clearAuthCookie, getAuthCookiePayload, setAuthCookie } from "./sessionCookie";

/**
 * Self-serve login, app-owned (lib/auth/passwordAuth.ts): sign up, sign in, password reset, log out.
 * Every refusal is a redirect with a reason the page shows; nothing here reveals whether an email
 * has an account (sign-in and reset answer the same for both).
 */
function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getRawFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getRedirectPath(formData: FormData, fallback = "/app") {
  const next = getFormString(formData, "next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

async function startSession(auth: PasswordAuth, userId: string) {
  const session = await auth.createSession(userId);
  await setAuthCookie({ accessToken: session.token, expiresAt: Math.floor(Date.parse(session.expiresAt) / 1000) });
}

export async function loginWithPassword(formData: FormData) {
  const email = getFormString(formData, "email");
  const password = getRawFormString(formData, "password");
  const next = getRedirectPath(formData);

  if (!email || !password) redirect(`/login?error=missing_credentials&next=${encodeURIComponent(next)}`);

  const result = await new PasswordAuth().signIn(email, password).catch(() => ({ ok: false as const }));
  if (!result.ok) redirect(`/login?error=invalid_login&next=${encodeURIComponent(next)}`);

  await setAuthCookie({ accessToken: result.token, expiresAt: Math.floor(Date.parse(result.expiresAt) / 1000) });
  redirect(next);
}

export async function signupWithPassword(formData: FormData) {
  const email = getFormString(formData, "email");
  const password = getRawFormString(formData, "password");
  const fullName = getFormString(formData, "full_name");

  if (!email || !password) redirect("/signup?error=missing_credentials");

  const auth = new PasswordAuth();
  const result = await auth.signUp({ email, password, fullName }).catch((error) => ({ ok: false as const, reason: error instanceof Error ? error.message : "The account could not be created." }));
  if (!result.ok) redirect(`/signup?error=${encodeURIComponent(result.reason)}`);

  await startSession(auth, result.userId);
  redirect("/app");
}

export async function requestPasswordReset(formData: FormData) {
  const email = getFormString(formData, "email");
  if (!email) redirect("/forgot-password?error=missing_email");

  const reset = await new PasswordAuth().createPasswordReset(email).catch(() => undefined);
  if (reset) {
    const link = `${getEnv().NEXT_PUBLIC_APP_URL || "https://westpeek.live"}/reset-password?token=${reset.token}`;
    await sendEmail({
      to: email.toLowerCase(),
      subject: "Reset your West Peek Live password",
      html: `<p>Someone asked to reset the password for this West Peek Live account.</p><p><a href="${link}">Choose a new password</a></p><p>The link works once and expires in one hour. If it was not you, ignore this email; nothing changes.</p>`,
      text: `Choose a new password: ${link}\n\nThe link works once and expires in one hour. If it was not you, ignore this email.`,
    }).catch(() => undefined);
  }
  // The same answer whether or not the address has an account.
  redirect("/login?notice=password_reset_sent");
}

export async function completePasswordReset(formData: FormData) {
  const token = getFormString(formData, "token");
  const password = getRawFormString(formData, "password");
  if (!token || !password) redirect(`/reset-password?token=${encodeURIComponent(token)}&error=missing_credentials`);
  const result = await new PasswordAuth().completePasswordReset(token, password).catch(() => ({ ok: false as const, reason: "The password could not be changed. Ask for a new link." }));
  if (!result.ok) redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(result.reason)}`);
  redirect("/login?notice=password_reset_done");
}

export async function logout() {
  const session = await getAuthCookiePayload();
  await new PasswordAuth().revokeSession(session?.accessToken).catch(() => undefined);
  await clearAuthCookie();
  redirect("/login");
}
