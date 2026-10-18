import type { Metadata } from "next";
import { RouteForm } from "@/components/route-form";
import { listOwnCompanies } from "@/lib/companies/queries";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.route.title };

export default async function RoutePage({ searchParams }: PageProps<"/">) {
  const companies = await listOwnCompanies();

  // Set by the company form when it was opened from here (CLAUDE.md §5.2).
  const { added } = await searchParams;
  const addedId = typeof added === "string" ? added : undefined;

  return <RouteForm companies={companies} addedId={addedId} />;
}
