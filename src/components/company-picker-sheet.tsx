"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";
import { useVisualViewport } from "@/lib/use-visual-viewport";
import type { CompanyWithContacts } from "@/lib/companies/queries";

type Props = {
  companies: CompanyWithContacts[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
};

export function CompanyPickerSheet({
  companies,
  selectedIds,
  onConfirm,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Draft selection so closing with Huỷ leaves the route untouched.
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const searchRef = useRef<HTMLInputElement>(null);
  const viewport = useVisualViewport();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.display_name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [companies, query]);

  function openChange(next: boolean) {
    if (next) {
      setDraft(selectedIds);
      setQuery("");
    }
    setOpen(next);
  }

  function toggle(id: string) {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Sheet open={open} onOpenChange={openChange}>
      <SheetTrigger asChild>
        <Button variant="secondary" className="h-12 w-full gap-2 font-semibold">
          <Plus className="size-5" aria-hidden />
          {vi.route.addDestination}
        </Button>
      </SheetTrigger>

      {/* Full screen with the search box at the very top, not a bottom sheet.
          A sheet hanging off the bottom edge puts the search box in the half
          of the screen the keyboard takes, and the phone then shoves it
          around to keep it in view. Sizing to the visual viewport keeps the
          Xong button sitting on top of the keys instead of under them. */}
      <SheetContent
        side="top"
        showCloseButton={false}
        className="mx-auto flex max-w-md flex-col gap-0 border-b-0 p-0"
        style={{
          top: viewport?.offsetTop ?? 0,
          height: viewport?.height ?? "100dvh",
        }}
        onOpenAutoFocus={(e) => {
          // Radix focuses the first control, which is now the back button.
          e.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <SheetHeader
          className="shrink-0 flex-row items-center gap-1 border-b py-3 pr-4 pl-2"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))" }}
        >
          <SheetTitle className="sr-only">{vi.picker.title}</SheetTitle>
          <SheetDescription className="sr-only">
            {vi.picker.description}
          </SheetDescription>

          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={vi.common.close}
            >
              <ArrowLeft className="size-5" aria-hidden />
            </Button>
          </SheetClose>

          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={vi.picker.search}
              className="h-12 pl-9"
              aria-label={vi.picker.search}
              enterKeyHint="search"
              autoComplete="off"
            />
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {results.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {companies.length === 0 ? vi.picker.empty : vi.picker.notFound}
              </p>
              <Button asChild variant="outline" className="mt-4 gap-2">
                <Link href="/companies/new?returnTo=/">
                  <Plus className="size-4" aria-hidden />
                  {vi.picker.create}
                </Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {results.map((c) => {
                const checked = draft.includes(c.id);
                return (
                  <li key={c.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                        checked
                          ? "border-primary bg-tint"
                          : "bg-card hover:bg-muted",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(c.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block font-medium",
                            checked
                              ? "text-tint-foreground"
                              : "text-foreground",
                          )}
                        >
                          {c.display_name}
                        </span>
                        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground wrap-anywhere">
                          {c.address}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <SheetFooter
          className="shrink-0 flex-row gap-3 border-t px-4 py-3"
          style={{
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <Button
            variant="outline"
            className="h-action flex-1"
            onClick={() => setOpen(false)}
          >
            {vi.picker.cancel}
          </Button>
          <Button
            className="h-action flex-[2] font-semibold"
            onClick={() => {
              onConfirm(draft);
              setOpen(false);
            }}
          >
            {vi.picker.done}
            {draft.length > 0 ? ` (${draft.length})` : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
