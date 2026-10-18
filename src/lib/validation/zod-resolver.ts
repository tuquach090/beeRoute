import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Minimal stand-in for @hookform/resolvers/zod.
 *
 * That package is not in the library list of CLAUDE.md §2, and its optional
 * peer pulls zod v3 while shadcn's registry requires v4 — an unresolvable
 * conflict. The adapter is small enough to own.
 */
export function zodResolver<TOut extends FieldValues, TIn extends FieldValues>(
  schema: ZodType<TOut, TIn>,
): Resolver<TIn, unknown, TOut> {
  return async (values) => {
    const parsed = await schema.safeParseAsync(values);

    if (parsed.success) {
      return { values: parsed.data, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      // react-hook-form addresses nested fields as "contacts.0.phone".
      const path = issue.path.join(".");
      // Keep the first message per field; later ones are usually follow-on noise.
      if (path && !errors[path]) {
        errors[path] = { type: issue.code, message: issue.message };
      }
    }

    return {
      values: {},
      errors: errors as never,
    };
  };
}
