import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { subscribePush, unsubscribePush } from "../app/actions/push";
import { buildLossPayload, pushConfigured } from "../lib/push";

const mockCreateClient = vi.mocked(createClient);
const USER_ID = "11111111-1111-1111-1111-111111111111";

const VALID_SUB = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

function queryBuilder(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const b: Record<string, unknown> & {
    then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => Promise<unknown>;
  } = {
    upsert: vi.fn(() => b),
    delete: vi.fn(() => b),
    eq: vi.fn(() => b),
    then: (onOk, onErr) => Promise.resolve(result).then(onOk, onErr),
  };
  return b;
}

function makeSupabase(user: { id: string } | null, builder = queryBuilder()) {
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => builder),
  };
  mockCreateClient.mockResolvedValue(
    supabase as unknown as Awaited<ReturnType<typeof createClient>>
  );
  return { supabase, builder };
}

beforeEach(() => vi.clearAllMocks());

describe("subscribePush", () => {
  it("rejects unauthenticated callers", async () => {
    const { supabase } = makeSupabase(null);
    expect(await subscribePush(VALID_SUB)).toEqual({ ok: false });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("rejects malformed subscription payloads before touching the DB", async () => {
    const { supabase } = makeSupabase({ id: USER_ID });
    const bad = [
      null,
      {},
      { endpoint: "http://insecure.example", keys: { p256dh: "a", auth: "b" } },
      { endpoint: "https://ok.example", keys: { p256dh: 1, auth: "b" } },
      { endpoint: "https://ok.example" },
    ];
    for (const sub of bad) {
      expect(await subscribePush(sub as typeof VALID_SUB)).toEqual({ ok: false });
    }
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("upserts the subscription keyed on endpoint for the session user", async () => {
    const { builder } = makeSupabase({ id: USER_ID });
    expect(await subscribePush(VALID_SUB)).toEqual({ ok: true });
    expect(builder.upsert).toHaveBeenCalledWith(
      {
        user_id: USER_ID,
        endpoint: VALID_SUB.endpoint,
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
      { onConflict: "endpoint" }
    );
  });

  it("returns ok:false when the upsert fails (e.g. RLS on a foreign endpoint)", async () => {
    makeSupabase({ id: USER_ID }, queryBuilder({ data: null, error: { message: "rls" } }));
    expect(await subscribePush(VALID_SUB)).toEqual({ ok: false });
  });
});

describe("unsubscribePush", () => {
  it("rejects unauthenticated callers", async () => {
    const { supabase } = makeSupabase(null);
    expect(await unsubscribePush(VALID_SUB.endpoint)).toEqual({ ok: false });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("scopes the delete to the caller's own row", async () => {
    const { builder } = makeSupabase({ id: USER_ID });
    expect(await unsubscribePush(VALID_SUB.endpoint)).toEqual({ ok: true });
    expect(builder.eq).toHaveBeenCalledWith("endpoint", VALID_SUB.endpoint);
    expect(builder.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

describe("buildLossPayload", () => {
  it("names the attacker and formats the lost area", () => {
    const payload = buildLossPayload("6prashant1singhal9", 17444.47);
    expect(payload.title).toContain("under attack");
    expect(payload.body).toContain("6prashant1singhal9");
    expect(payload.body).toContain("0.017 km²");
    expect(payload.url).toBe("/map");
  });
});

describe("pushConfigured", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is false when any required env var is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("VAPID_SUBJECT", "mailto:x@y.z");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(pushConfigured()).toBe(false);
  });

  it("is true when everything is present", () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("VAPID_SUBJECT", "mailto:x@y.z");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    expect(pushConfigured()).toBe(true);
  });
});
