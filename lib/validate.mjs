/**
 * Shared validation helpers — extracted for reuse between plugin.js and groups.mjs.
 * This is step 1 of the modularization plan (see ARCHITECTURE.md).
 */

export const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const UUID_RE =
 /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidName(name) {
 return typeof name === "string" && NAME_RE.test(name);
}

export function assertValidName(name) {
 if (!isValidName(name))
  throw new Error(`Invalid name "${name}" — must match ${NAME_RE.source}`);
}

export function shellQuote(arg) {
 return JSON.stringify(String(arg));
}

export function sanitizeTitle(title) {
 return String(title || "")
  .replace(/[\r\n"`$\\]/g, "")
  .slice(0, 80);
}
