import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { adminApi, adminToken } from "./admin-api";

describe("real-server-only admin authentication", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("invalidates the retired demo session and removes simulated records", () => {
    window.localStorage.setItem("lifeos_admin_token", "demo");
    window.localStorage.setItem("lifeos_admin_demo_db", '{"members":[]}');
    expect(adminToken.get()).toBeNull();
    expect(window.localStorage.getItem("lifeos_admin_token")).toBeNull();
    expect(window.localStorage.getItem("lifeos_admin_demo_db")).toBeNull();
  });

  it("requires the server to reject a retired demo session", async () => {
    window.localStorage.setItem("lifeos_admin_token", "demo");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(adminApi("/me")).rejects.toThrow("Unauthorized");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1].headers.Authorization).toBeUndefined();
  });

  it("preserves genuine tokens and sends them to the PHP API", async () => {
    adminToken.set("test-real-server-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 42 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await adminApi("/me")).toEqual({ id: 42 });
    expect(fetchMock.mock.calls[0]?.[1].headers.Authorization).toBe("Bearer test-real-server-token");
    expect(adminToken.get()).toBe("test-real-server-token");
  });
});