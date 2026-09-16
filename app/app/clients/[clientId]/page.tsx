import { ClientDetail } from "@/components/clients/ClientDetail";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const resolvedParams = await params;
  return <ClientDetail clientId={resolvedParams.clientId} />;
}
