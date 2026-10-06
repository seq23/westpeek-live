import Link from "next/link";
import { NewPasswordForm } from "@/components/auth/AuthForms";
import { AuthStatusBanner } from "@/components/auth/AuthStatusBanner";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">West Peek Live!</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Choose a new password</h1>
        <p className="mt-2 text-slate-600">At least 10 characters. Every other signed-in session ends when you save.</p>
        <AuthStatusBanner error={error} />
        {token ? <NewPasswordForm token={token} /> : <p className="mt-4 text-sm text-rose-900">This page needs the link from the reset email.</p>}
        <Link className="mt-4 block text-sm text-slate-500" href="/forgot-password">Ask for a new link</Link>
      </div>
    </main>
  );
}
