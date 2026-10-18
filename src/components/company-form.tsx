"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { ChevronLeft, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddressInput } from "@/components/address-input";
import { zodResolver } from "@/lib/validation/zod-resolver";
import {
  companySchema,
  type CompanyInput,
  type CompanyValues,
} from "@/lib/validation/company";
import { deleteCompany, saveCompany } from "@/lib/companies/actions";
import type { CompanyWithContacts } from "@/lib/companies/queries";
import { vi } from "@/lib/i18n/vi";

type Props = {
  /** Omitted when creating. */
  company?: CompanyWithContacts;
  /** Where to go after saving, from ?returnTo= (CLAUDE.md §5.3). */
  returnTo?: string;
};

function toFormValues(company?: CompanyWithContacts): CompanyInput {
  if (!company) {
    return {
      displayName: "",
      address: "",
      lat: Number.NaN,
      lng: Number.NaN,
      note: "",
      isPublic: false,
      contacts: [{ contactName: "", phone: "" }],
    };
  }
  return {
    displayName: company.display_name,
    address: company.address,
    lat: company.lat,
    lng: company.lng,
    note: company.note ?? "",
    isPublic: company.is_public,
    contacts: company.company_contacts.length
      ? company.company_contacts.map((c) => ({
          id: c.id,
          contactName: c.contact_name ?? "",
          phone: c.phone ?? "",
        }))
      : [{ contactName: "", phone: "" }],
  };
}

export function CompanyForm({ company, returnTo }: Props) {
  const router = useRouter();
  const nameId = useId();
  const addressId = useId();
  const noteId = useId();
  const publicId = useId();

  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  const isEdit = Boolean(company);
  const backHref = returnTo ?? "/companies";

  const form = useForm<CompanyInput, unknown, CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: toFormValues(company),
    mode: "onSubmit",
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "contacts",
  });

  // useWatch instead of watch(): the latter returns a fresh function each
  // render, which React Compiler cannot memoize.
  const address = useWatch({ control, name: "address" });
  const lat = useWatch({ control, name: "lat" });
  const lng = useWatch({ control, name: "lng" });
  const isPublic = useWatch({ control, name: "isPublic" });

  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);

  async function onSubmit(values: CompanyValues) {
    setServerError(null);
    const result = await saveCompany(company?.id ?? null, values);

    if (!result.ok) {
      setServerError(result.message);
      return;
    }

    // Coming back from "create company" inside the route builder: flag the new
    // id so that screen can preselect it (CLAUDE.md §5.2).
    if (returnTo) {
      const url = new URL(returnTo, window.location.origin);
      url.searchParams.set("added", result.id);
      router.push(url.pathname + url.search);
    } else {
      router.push("/companies");
    }
    router.refresh();
  }

  function onDelete() {
    if (!company) return;
    startDelete(async () => {
      const result = await deleteCompany(company.id);
      if (!result.ok) {
        setServerError(result.message);
        return;
      }
      router.push("/companies");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-28">
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon" aria-label={vi.common.back}>
          <Link href={backHref}>
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          {isEdit ? vi.companyForm.editTitle : vi.companyForm.createTitle}
        </h1>
      </div>

      {serverError && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </p>
      )}

      <Field
        id={nameId}
        label={vi.companyForm.displayName}
        required
        error={errors.displayName?.message}
      >
        <Input
          id={nameId}
          className="h-12"
          maxLength={120}
          placeholder={vi.companyForm.displayNamePlaceholder}
          {...register("displayName")}
        />
      </Field>

      <Field
        id={addressId}
        label={vi.companyForm.address}
        required
        error={errors.address?.message ?? errors.lat?.message}
      >
        <AddressInput
          id={addressId}
          value={address}
          location={hasLocation ? { lat, lng } : null}
          invalid={Boolean(errors.address || errors.lat)}
          onChange={(nextAddress, nextLocation) => {
            setValue("address", nextAddress, { shouldValidate: false });
            setValue("lat", nextLocation ? nextLocation.lat : Number.NaN);
            setValue("lng", nextLocation ? nextLocation.lng : Number.NaN);
          }}
        />
      </Field>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            {vi.companyForm.contacts}{" "}
            <span className="font-normal text-muted-foreground">
              ({vi.common.optional})
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {vi.companyForm.contactsHint}
          </p>
        </div>

        <ul className="space-y-3">
          {fields.map((field, index) => (
            <ContactFields
              key={field.id}
              index={index}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
              register={register}
              nameError={errors.contacts?.[index]?.contactName?.message}
              phoneError={errors.contacts?.[index]?.phone?.message}
            />
          ))}
        </ul>

        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full gap-2 font-semibold"
          onClick={() => append({ contactName: "", phone: "" })}
        >
          <Plus className="size-4" aria-hidden />
          {vi.companyForm.addContact}
        </Button>
      </section>

      <Field
        id={noteId}
        label={vi.companyForm.note}
        error={errors.note?.message}
      >
        <Textarea
          id={noteId}
          rows={4}
          placeholder={vi.companyForm.notePlaceholder}
          {...register("note")}
        />
      </Field>

      <label
        htmlFor={publicId}
        className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4"
      >
        <Checkbox
          id={publicId}
          checked={isPublic}
          onCheckedChange={(v) => setValue("isPublic", v === true)}
          className="mt-0.5"
        />
        <span>
          <span className="block text-sm font-semibold">
            {vi.companyForm.isPublic}
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {vi.companyForm.isPublicHint}
          </span>
        </span>
      </label>

      {isEdit && (
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-12 w-full gap-2 text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
              {vi.companyForm.delete}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xs rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-left">
                {vi.companyForm.deleteConfirmTitle}
              </DialogTitle>
              <DialogDescription className="text-left">
                {vi.companyForm.deleteConfirmBody(company?.display_name ?? "")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-row gap-3">
              <DialogClose asChild>
                <Button variant="outline" className="h-12 flex-1">
                  {vi.companyForm.cancel}
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                className="h-12 flex-1"
                onClick={onDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                {vi.companyForm.delete}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div
        className="fixed inset-x-0 bottom-tabbar z-20 border-t bg-card/95 px-4 py-3 backdrop-blur"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-md gap-3">
          <Button asChild variant="outline" className="h-action flex-1">
            <Link href={backHref}>{vi.companyForm.cancel}</Link>
          </Button>
          <Button
            type="submit"
            className="h-action flex-[2] gap-2 text-base font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {vi.companyForm.save}
          </Button>
        </div>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : (
          <span className="font-normal text-muted-foreground">
            ({vi.common.optional})
          </span>
        )}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

type RegisterFn = ReturnType<
  typeof useForm<CompanyInput, unknown, CompanyValues>
>["register"];

function ContactFields({
  index,
  canRemove,
  onRemove,
  register,
  nameError,
  phoneError,
}: {
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  register: RegisterFn;
  nameError?: string;
  phoneError?: string;
}) {
  const nameId = useId();
  const phoneId = useId();

  return (
    <li className="rounded-xl border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="tnum text-xs font-semibold text-muted-foreground">
          #{index + 1}
        </span>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={vi.companyForm.removeContact}
            onClick={onRemove}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label htmlFor={nameId} className="text-xs text-muted-foreground">
            {vi.companyForm.contactName}
          </Label>
          <Input
            id={nameId}
            className="h-12"
            placeholder={vi.companyForm.contactNamePlaceholder}
            {...register(`contacts.${index}.contactName`)}
          />
          {nameError && <p className="text-xs text-destructive">{nameError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={phoneId} className="text-xs text-muted-foreground">
            {vi.companyForm.phone}
          </Label>
          <Input
            id={phoneId}
            type="tel"
            inputMode="tel"
            className="tnum h-12"
            placeholder={vi.companyForm.phonePlaceholder}
            {...register(`contacts.${index}.phone`)}
          />
          {phoneError && (
            <p className="text-xs text-destructive">{phoneError}</p>
          )}
        </div>
      </div>
    </li>
  );
}
