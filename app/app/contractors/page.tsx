import { SupplierDirectory } from "@/components/suppliers/SupplierDirectory";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/** Every person West Peek hires for a show, across every event, with the CSV export. */
export default async function ContractorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = await searchParams;
  return <SafeSection label="Contractors" render={() => SupplierDirectory({ kind: "contractor", searchParams: resolved })} />;
}
