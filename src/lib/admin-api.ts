// Browser-only client for the standalone PHP admin API (mirrors member-api).
import { LIFEOS_API_BASE as BASE } from "./api-base";
export const ADMIN_API_BASE = BASE;
const KEY = "lifeos_admin_token";
export const adminToken = {
  get: () => {
    if (typeof window === "undefined") return null;
    window.localStorage.removeItem("lifeos_admin_demo_db");
    const token = window.localStorage.getItem(KEY);
    if (token === "demo") {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return token;
  },
  set: (t: string) => window.localStorage.setItem(KEY, t),
  clear: () => window.localStorage.removeItem(KEY),
};

export async function adminApi<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = adminToken.get();
  const method = init.method ?? (init.body ? "POST" : "GET");
  const res = await fetch(`${BASE}/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}`, "X-Auth-Token": `Bearer ${token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : null,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    if (res.status === 401) adminToken.clear();
    throw new Error(json?.error ?? json?.message ?? `Request failed (${res.status})`);
  }
  return (json && "data" in json ? json.data : json) as T;
}

/** Build a query string from non-empty filter values. */
export const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};
