"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { vi } from "@/lib/i18n/vi";

type Props = {
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export function AccountMenu({ fullName, email, avatarUrl }: Props) {
  const label = fullName ?? email ?? vi.account.title;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={vi.account.open}
        >
          {avatarUrl ? (
            // Google avatar hosts are not in next.config images.remotePatterns,
            // so a plain <img> avoids the optimizer rejecting the URL.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-7 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <UserIcon className="size-5" />
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xs rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-left">{label}</DialogTitle>
          {email && (
            <DialogDescription className="text-left break-all">
              {email}
            </DialogDescription>
          )}
        </DialogHeader>

        <form action="/auth/signout" method="post" className="mt-2">
          <Button
            type="submit"
            variant="outline"
            className="h-12 w-full gap-2 font-semibold text-destructive"
          >
            <LogOut className="size-4" aria-hidden />
            {vi.account.signOut}
          </Button>
        </form>

        <DialogClose asChild>
          <Button variant="ghost" className="h-11 w-full">
            {vi.common.close}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
