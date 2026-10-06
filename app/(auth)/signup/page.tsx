import Link from "next/link";
import { SignupForm } from "@/components/auth/AuthForms";
import { AuthStatusBanner } from "@/components/auth/AuthStatusBanner";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const resolvedSearchParams = await searchParams;
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-slate-500">West Peek Live!</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Create account</h1>
        <p className="mt-2 text-slate-600">Account creation is real and signs you in at once; production access still depends on a role assignment.</p>
        <AuthStatusBanner error={resolvedSearchParams.error} notice={resolvedSearchParams.notice} />
        <SignupForm />
        <Link className="mt-4 block text-sm text-slate-500" href="/login">Already have an account?</Link>
      </div>
    </main>
  );
}
