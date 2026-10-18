import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyForm } from "@/components/company-form";
import { getCompany } from "@/lib/companies/queries";
import { createClient } from "@/lib/supabase/server";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.companyForm.editTitle };

export default async function EditCompanyPage({
  params,
}: PageProps<"/companies/[id]/edit">) {
  const { id } = await params;
  const company = await getCompany(id);

  if (!company) notFound();

  // RLS lets anyone read a public company, but only the owner may edit one.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (company.user_id !== user?.id) notFound();

  return <CompanyForm company={company} />;
}
