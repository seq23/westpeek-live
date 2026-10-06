const messages: Record<string, string> = {
  missing_credentials: "Email and password are required.",
  invalid_login: "Login failed. Check the email/password and try again.",
  missing_email: "Email is required.",
  check_email: "Check your email to confirm the account before logging in.",
  password_reset_sent: "If that address has an account, a reset link is on its way.",
  password_reset_done: "Password changed. Log in with the new one.",
  auth_callback_failed: "Auth callback failed. Try logging in again.",
};

export function AuthStatusBanner({ error, notice }: { error?: string; notice?: string }) {
  const key = error || notice;
  if (!key) return null;
  const message = messages[key] ?? decodeURIComponent(key);
  const tone = error ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900";
  return <div className={`mt-4 rounded-2xl border p-3 text-sm ${tone}`}>{message}</div>;
}
