import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CompanyList } from "@/components/company-list";
import { Button } from "@/components/ui/button";
import { listOwnCompanies } from "@/lib/companies/queries";
import { vi } from "@/lib/i18n/vi";

export const metadata: Metadata = { title: vi.companies.title };

export default async function CompaniesPage() {
  const companies = await listOwnCompanies();

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {vi.companies.title}
        </h1>
        <Button asChild size="sm" className="gap-1.5 font-semibold">
          <Link href="/companies/new">
            <Plus className="size-4" aria-hidden />
            {vi.companies.create}
          </Link>
        </Button>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-medium">{vi.companies.empty}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {vi.companies.emptyHint}
          </p>
          <Button asChild className="mt-5 h-12 gap-2 font-semibold">
            <Link href="/companies/new">
              <Plus className="size-4" aria-hidden />
              {vi.companies.create}
            </Link>
          </Button>
        </div>
      ) : (
        <CompanyList companies={companies} />
      )}
    </div>
  );
}
