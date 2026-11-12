/**
 * Development/preview uses the live Life OS backend; cPanel builds always call the
 * domain they are hosted on (current domain + /backendserver/api), so no rebuild is needed per domain.
 */
const DEFAULT_API = import.meta.env.MODE === "cpanel"
  ? "/backendserver/api"
  : "https://lifeosbd.com/backendserver/api";

export function resolveApiBase(configured?: string): string {
  return (configured?.trim() || DEFAULT_API).replace(/\/+$/, "");
}

export const LIFEOS_API_BASE = resolveApiBase(import.meta.env["VITE_LIFEOS_API_URL"] as string | undefined);
