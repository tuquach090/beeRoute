"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Loader2, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { vi } from "@/lib/i18n/vi";

const TABS = [
  { href: "/", label: vi.nav.route, icon: Route },
  { href: "/companies", label: vi.nav.companies, icon: Building2 },
] as const;

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label={vi.nav.route}
      // pb from the safe area so the bar clears the iPhone home indicator.
      className="sticky bottom-0 z-30 border-t bg-card/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex h-tabbar max-w-md">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <TabIcon Icon={Icon} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Swaps the tab icon for a spinner while its navigation is in flight.
 *
 * useLinkStatus only reports for the Link it sits inside, so this has to be a
 * child component rather than state held by the nav.
 */
function TabIcon({ Icon }: { Icon: typeof Route }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <Loader2 className="size-6 animate-spin" aria-hidden />
  ) : (
    <Icon className="size-6" aria-hidden />
  );
}
