import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "../app/api/territories/route";

const mockCreateClient = vi.mocked(createClient);

function mockRpc(data: unknown, error: { message: string } | null) {
  mockCreateClient.mockResolvedValue({
    rpc: vi.fn().mockResolvedValue({ data, error }),
  } as ReturnType<typeof createClient> extends Promise<infer T> ? T : never);
}

describe("GET /api/territories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns GeoJSON FeatureCollection on success", async () => {
    const fc = { type: "FeatureCollection", features: [] };
    mockRpc(fc, null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("FeatureCollection");
  });

  it("returns HTTP 500 with generic message on RPC error", async () => {
    mockRpc(null, { message: "relation \"territories\" does not exist" });
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    // Must NOT leak the raw Postgres error message
    expect(body.error).toBe("Failed to load territories.");
    expect(body.error).not.toContain("relation");
    expect(body.error).not.toContain("does not exist");
  });

  it("falls back to empty FeatureCollection when RPC returns null data", async () => {
    mockRpc(null, null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ type: "FeatureCollection", features: [] });
  });
});

// fetchTerritories (extracted for unit testing)
async function fetchTerritories(
  fetcher: typeof fetch
): Promise<GeoJSON.FeatureCollection> {
  const res = await fetcher("/api/territories", { cache: "no-store" });
  if (!res.ok) throw new Error(`territories fetch failed: ${res.status}`);
  return res.json() as Promise<GeoJSON.FeatureCollection>;
}

describe("fetchTerritories", () => {
  it("returns parsed GeoJSON on 200", async () => {
    const fc = { type: "FeatureCollection", features: [] };
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(fc), { status: 200 })
    );
    const result = await fetchTerritories(mockFetch as unknown as typeof fetch);
    expect(result).toEqual(fc);
  });

  it("throws on HTTP 500 so TanStack Query keeps previous data", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Failed to load territories." }), {
        status: 500,
      })
    );
    await expect(
      fetchTerritories(mockFetch as unknown as typeof fetch)
    ).rejects.toThrow("territories fetch failed: 500");
  });

  it("throws on any non-200 response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 503 })
    );
    await expect(
      fetchTerritories(mockFetch as unknown as typeof fetch)
    ).rejects.toThrow("503");
  });
});
