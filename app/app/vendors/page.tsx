import { SupplierDirectory } from "@/components/suppliers/SupplierDirectory";
import { SafeSection } from "@/components/system/SafeSection";

export const dynamic = "force-dynamic";

/** Every company supplying a service to a show, across every event, with the CSV export. */
export default async function VendorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const resolved = await searchParams;
  return <SafeSection label="Vendors" render={() => SupplierDirectory({ kind: "vendor", searchParams: resolved })} />;
}
