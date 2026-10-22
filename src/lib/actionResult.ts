/**
 * Server actions signal user-facing failures by returning an error as
 * DATA — a plain `{ __actionError: message }` object — instead of
 * throwing. A thrown error's message is redacted by Next.js in
 * production builds ("An error occurred in the Server Components
 * render…"), so it never reaches the user; a returned plain object
 * crosses the wire untouched. Client call sites pass every action
 * result through `unwrapActionResult`, which turns the sentinel back
 * into a thrown Error carrying the real message, so the existing
 * try/catch error displays (form errors, toasts) work unchanged.
 *
 * This module is client-safe: it must never import server-only code.
 */

export type ActionErrorResult = { __actionError: string };

export function isActionErrorResult(value: unknown): value is ActionErrorResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { __actionError?: unknown }).__actionError === "string"
  );
}

/**
 * Returns the action's success value, or throws an Error with the real
 * user-facing message when the action returned an error sentinel.
 */
export function unwrapActionResult<R>(result: R | ActionErrorResult): R {
  if (isActionErrorResult(result)) {
    throw new Error(result.__actionError);
  }
  return result as R;
}
