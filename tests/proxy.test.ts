import { vi, describe, it, expect, beforeEach } from "vitest";

vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

const mockCreateServerClient = vi.mocked(createServerClient);

function mockUser(user: { id: string } | null) {
  mockCreateServerClient.mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as ReturnType<typeof createServerClient>);
}

function req(pathname: string) {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

describe("proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("unauthenticated user", () => {
    it("passes through on /", async () => {
      mockUser(null);
      const res = await proxy(req("/"));
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through on /auth/login", async () => {
      mockUser(null);
      const res = await proxy(req("/auth/login"));
      expect(res.headers.get("location")).toBeNull();
    });

    it("redirects /map → /auth/login", async () => {
      mockUser(null);
      const res = await proxy(req("/map"));
      expect(res.headers.get("location")).toContain("/auth/login");
    });

    it("redirects /leaderboard → /auth/login", async () => {
      mockUser(null);
      const res = await proxy(req("/leaderboard"));
      expect(res.headers.get("location")).toContain("/auth/login");
    });

    it("redirects /profile → /auth/login", async () => {
      mockUser(null);
      const res = await proxy(req("/profile"));
      expect(res.headers.get("location")).toContain("/auth/login");
    });
  });

  describe("authenticated user", () => {
    it("redirects / → /map", async () => {
      mockUser({ id: "user-1" });
      const res = await proxy(req("/"));
      expect(res.headers.get("location")).toContain("/map");
    });

    it("redirects /auth/login → /map", async () => {
      mockUser({ id: "user-1" });
      const res = await proxy(req("/auth/login"));
      expect(res.headers.get("location")).toContain("/map");
    });

    it("does not redirect /auth/callback (PKCE exchange must complete)", async () => {
      mockUser({ id: "user-1" });
      const res = await proxy(req("/auth/callback"));
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through on /map", async () => {
      mockUser({ id: "user-1" });
      const res = await proxy(req("/map"));
      expect(res.headers.get("location")).toBeNull();
    });

    it("passes through on /leaderboard", async () => {
      mockUser({ id: "user-1" });
      const res = await proxy(req("/leaderboard"));
      expect(res.headers.get("location")).toBeNull();
    });
  });
});
