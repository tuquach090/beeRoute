import { redirect } from "next/navigation";
import { BottomTabs } from "@/components/bottom-tabs";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccountMenu } from "@/components/account-menu";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();

  // The middleware already blocks anonymous requests. This second check is the
  // one that actually matters: middleware can be bypassed by misconfigured
  // matchers, a server check cannot.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, email")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header
        className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Logo size={28} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu
              fullName={profile?.full_name ?? null}
              email={profile?.email ?? user.email ?? null}
              avatarUrl={profile?.avatar_url ?? null}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">
        {children}
      </main>

      <BottomTabs />
    </div>
  );
}
