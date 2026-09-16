import { ClientList } from "@/components/clients/ClientList";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams?: Promise<{ client?: string; error?: string }> }) {
  const search = searchParams ? await searchParams : undefined;
  return <ClientList createdClientId={search?.client} error={search?.error} />;
}
