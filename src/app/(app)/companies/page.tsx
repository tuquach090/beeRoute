import type { Metadata } from "next";
import Link from "next/link";
import { RowChevron } from "@/components/row-chevron";
import { Globe, Phone, Plus } from "lucide-react";
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
        <ul className="space-y-2">
          {companies.map((c) => (
            <li key={c.id}>
              <Link
                href={`/companies/${c.id}/edit`}
                className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{c.display_name}</span>
                    {c.is_public && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground">
                        <Globe className="size-3" aria-hidden />
                        {vi.companies.publicBadge}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm leading-5 text-muted-foreground wrap-anywhere">
                    {c.address}
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="size-3" aria-hidden />
                    {c.company_contacts.length > 0
                      ? vi.companies.contactCount(c.company_contacts.length)
                      : vi.companies.noContact}
                  </span>
                </span>
                <RowChevron />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
