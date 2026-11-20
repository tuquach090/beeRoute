"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Combine, Globe, Loader2, Phone } from "lucide-react";
import { RowChevron } from "@/components/row-chevron";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mergeCompanies } from "@/lib/companies/actions";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";
import type { CompanyWithContacts } from "@/lib/companies/queries";

/**
 * The company list, plus a merge mode: tick the duplicates, pick which one
 * survives, and the rest fold into it (merge_companies in the migration).
 */
export function CompanyList({
  companies,
}: {
  companies: CompanyWithContacts[];
}) {
  const router = useRouter();
  const [merging, setMerging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const chosen = companies.filter((c) => selected.includes(c.id));
  const target = chosen.find((c) => c.id === targetId) ?? null;

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function exitMerge() {
    setMerging(false);
    setSelected([]);
    setTargetId(null);
    setError(null);
  }

  function confirm() {
    if (!target) return;
    setError(null);
    startTransition(async () => {
      const result = await mergeCompanies(
        target.id,
        // Selection order decides whose photo a photo-less target inherits.
        selected.filter((id) => id !== target.id),
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      exitMerge();
      router.refresh();
    });
  }

  return (
    <>
      {companies.length >= 2 &&
        (merging ? (
          <p className="bg-tint text-tint-foreground rounded-xl p-3 text-sm leading-5">
            {vi.merge.selectHint}
          </p>
        ) : (
          <Button
            variant="outline"
            className="h-11 w-full gap-2"
            onClick={() => setMerging(true)}
          >
            <Combine className="size-4" aria-hidden />
            {vi.merge.start}
          </Button>
        ))}

      <ul className={cn("space-y-2", merging && "pb-20")}>
        {companies.map((c) => {
          const body = (
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
          );

          const checked = selected.includes(c.id);
          return (
            <li key={c.id}>
              {merging ? (
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                    checked
                      ? "border-primary bg-tint"
                      : "bg-card hover:bg-muted",
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggle(c.id)}
                  />
                  {body}
                </label>
              ) : (
                <Link
                  href={`/companies/${c.id}/edit`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted"
                >
                  {body}
                  <RowChevron />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {merging && (
        <div
          className="fixed inset-x-0 bottom-tabbar z-20 border-t bg-card/95 px-4 py-3 backdrop-blur"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="mx-auto flex max-w-md gap-3">
            <Button
              variant="outline"
              className="h-action flex-1"
              onClick={exitMerge}
            >
              {vi.merge.cancel}
            </Button>
            <Button
              className="h-action flex-[2] gap-2 text-base font-semibold"
              disabled={selected.length < 2}
              onClick={() => setTargetId(selected[0])}
            >
              <Combine className="size-4" aria-hidden />
              {vi.merge.next(selected.length)}
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={targetId !== null}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setTargetId(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-h-[85dvh] max-w-sm overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-left">
              {vi.merge.pickTitle}
            </DialogTitle>
            <DialogDescription className="text-left">
              {vi.merge.pickBody}
            </DialogDescription>
          </DialogHeader>

          <ul
            role="radiogroup"
            aria-label={vi.merge.pickTitle}
            className="space-y-2"
          >
            {chosen.map((c) => {
              const on = c.id === targetId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTargetId(c.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                      on ? "border-primary bg-tint" : "bg-card hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                      aria-hidden
                    >
                      {on && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block font-medium",
                          on ? "text-tint-foreground" : "text-foreground",
                        )}
                      >
                        {c.display_name}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground wrap-anywhere">
                        {c.address}
                      </span>
                      <span className="mt-1 block text-xs font-semibold">
                        {on ? vi.merge.keeps : vi.merge.goes}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {error && (
            <p className="bg-destructive/10 text-destructive rounded-lg p-2.5 text-sm">
              {error}
            </p>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              variant="destructive"
              className="h-12 w-full gap-2 font-semibold"
              onClick={confirm}
              disabled={!target || pending}
            >
              {pending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {target
                ? vi.merge.confirm(chosen.length - 1, target.display_name)
                : null}
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full"
              onClick={() => setTargetId(null)}
              disabled={pending}
            >
              {vi.merge.back}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
