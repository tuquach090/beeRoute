import type { Metadata } from "next";
import { CompanyForm } from "@/components/company-form";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.companyForm.createTitle };

export default async function NewCompanyPage({
  searchParams,
}: PageProps<"/companies/new">) {
  const { returnTo } = await searchParams;
  // Same-origin paths only, so the redirect after saving cannot be hijacked.
  const safeReturnTo =
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//")
      ? returnTo
      : undefined;

  return <CompanyForm returnTo={safeReturnTo} />;
}
