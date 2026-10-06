import { completePasswordReset, loginWithPassword, requestPasswordReset, signupWithPassword } from "@/lib/auth/actions";

export function LoginForm({ next = "/app" }: { next?: string }) {
  return (
    <form action={loginWithPassword} className="mt-6 space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-slate-700">Email</label>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2" name="email" type="email" autoComplete="email" required />
      <label className="block text-sm font-medium text-slate-700">Password</label>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2" name="password" type="password" autoComplete="current-password" required />
      <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">Log in</button>
    </form>
  );
}

export function SignupForm() {
  return (
    <form action={signupWithPassword} className="mt-6 space-y-3">
      <label className="block text-sm font-medium text-slate-700">Full name</label>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2" name="full_name" type="text" autoComplete="name" />
      <label className="block text-sm font-medium text-slate-700">Email</label>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2" name="email" type="email" autoComplete="email" required />
      <label className="block text-sm font-medium text-slate-700">Password</label>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2" name="password" type="password" autoComplete="new-password" minLength={10} required />
      <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">Create account</button>
    </form>
  );
}

export function PasswordResetForm() {
  return (
    <form action={requestPasswordReset} className="mt-6 space-y-3">
      <label className="block text-sm font-medium text-slate-700">Email</label>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2" name="email" type="email" autoComplete="email" required />
      <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">Send reset link</button>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  return (
    <form action={completePasswordReset} className="mt-6 space-y-3">
      <input type="hidden" name="token" value={token} />
      <label className="block text-sm font-medium text-slate-700">New password</label>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2" name="password" type="password" autoComplete="new-password" minLength={10} required />
      <button className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white" type="submit">Save new password</button>
    </form>
  );
}
