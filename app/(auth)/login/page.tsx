import Link from "next/link";
import { LoginForm } from "@/components/auth/AuthForms";
import { AuthStatusBanner } from "@/components/auth/AuthStatusBanner";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; notice?: string }> }) {
  const resolvedSearchParams = await searchParams;
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">West Peek Live!</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Log in</h1>
        <p className="mt-2 text-slate-600">Use your West Peek Live account to reach your agency, client, speaker, sponsor, or crew surface.</p>
        <AuthStatusBanner error={resolvedSearchParams.error} notice={resolvedSearchParams.notice} />
        <LoginForm next={resolvedSearchParams.next ?? "/app"} />
        <div className="mt-4 flex justify-between text-sm text-slate-500">
          <Link href="/forgot-password">Forgot password?</Link>
          <Link href="/signup">Create account</Link>
        </div>
      </div>
    </main>
  );
}
