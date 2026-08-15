/**
 * Ambient declarations for the host-provided modules and globals.
 *
 * The Hermes desktop injects `@hermes/plugin-sdk`, `react`, and
 * `react/jsx-runtime` at load time — they are not npm dependencies of this
 * repo, so `tsc` needs to be told they exist.
 *
 * These are SHORTHAND ambient module declarations (no body): every import from
 * them resolves to `any`, including named imports. Do not give them a body
 * with `export =` — that turns each named import into an error. The point of
 * `npm run typecheck` is to catch obvious shape errors in OUR code, not to
 * model the SDK surface.
 */

declare module "@hermes/plugin-sdk";
declare module "react";
declare module "react/jsx-runtime";

interface Window {
  /** Injected by the Electron shell; absent in the browser preview. */
  hermesDesktop?: {
    openExternal?: (url: string) => void;
    [key: string]: unknown;
  };
}
