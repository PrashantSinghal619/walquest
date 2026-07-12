import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("@/lib/push", () => ({
  notifyTerritoryLoss: vi.fn().mockResolvedValue(undefined),
}));

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, updateTag } from "next/cache";
import { notifyTerritoryLoss } from "@/lib/push";
import { startWalk, completeWalk, discardWalk } from "../app/actions/walks";

const mockCreateClient = vi.mocked(createClient);

const USER_ID = "11111111-1111-1111-1111-111111111111";
const WALK_ID = "22222222-2222-2222-2222-222222222222";
const TERRITORY_ID = "33333333-3333-3333-3333-333333333333";

// ~1.1km × ~1.1km square in central Bengaluru - passes buildPolygon
const VALID_LOOP: Array<[number, number]> = [
  [77.59, 12.97],
  [77.6, 12.97],
  [77.6, 12.98],
  [77.59, 12.98],
];

// Two crossing diagonals - fails the kinks check
const SELF_INTERSECTING: Array<[number, number]> = [
  [77.59, 12.97],
  [77.6, 12.98],
  [77.6, 12.97],
  [77.59, 12.98],
];

/**
 * Chainable, thenable query builder mock. Supabase builders are thenable:
 * `await supabase.from(...).update(...).eq(...)` awaits the builder itself,
 * while `.single()` resolves separately. `result` feeds both.
 */
type QueryBuilderMock = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => Promise<unknown>;
};

function queryBuilder(
  result: { data?: unknown; error?: unknown } = { data: null, error: null }
): QueryBuilderMock {
  const b: QueryBuilderMock = {
    select: vi.fn(() => b),
    insert: vi.fn(() => b),
    update: vi.fn(() => b),
    upsert: vi.fn(() => b),
    eq: vi.fn(() => b),
    in: vi.fn(() => b),
    single: vi.fn(() => Promise.resolve(result)),
    then: (onOk, onErr) => Promise.resolve(result).then(onOk, onErr),
  };
  return b;
}

type TableResults = Record<string, QueryBuilderMock[]>;

/**
 * Builds a supabase mock where each `from(table)` call consumes the next
 * builder queued for that table (completeWalk hits `walks` twice: the
 * ownership select, then the completion update).
 */
function makeSupabase({
  user = { id: USER_ID },
  tables = {},
  rpcResult = { data: null, error: null },
}: {
  user?: { id: string } | null;
  tables?: TableResults;
  rpcResult?: { data: unknown; error: unknown };
} = {}) {
  const consumed: Record<string, number> = {};
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn((table: string) => {
      const queue = tables[table] ?? [];
      const i = consumed[table] ?? 0;
      consumed[table] = i + 1;
      return queue[i] ?? queryBuilder();
    }),
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };
  mockCreateClient.mockResolvedValue(supabase as unknown as Awaited<ReturnType<typeof createClient>>);
  return supabase;
}

beforeEach(() => vi.clearAllMocks());

describe("startWalk", () => {
  it("rejects unauthenticated callers before touching the database", async () => {
    const supabase = makeSupabase({ user: null });
    const result = await startWalk();
    expect(result.ok).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns the new walk id on success", async () => {
    makeSupabase({
      tables: {
        users: [queryBuilder()],
        walks: [queryBuilder({ data: { id: WALK_ID }, error: null })],
      },
    });
    const result = await startWalk();
    expect(result).toEqual({ ok: true, walkId: WALK_ID });
  });

  it("returns a generic error when the insert fails (no DB details leaked)", async () => {
    makeSupabase({
      tables: {
        users: [queryBuilder()],
        walks: [queryBuilder({ data: null, error: { message: "duplicate key violates constraint walks_pkey" } })],
      },
    });
    const result = await startWalk();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Failed to start walk.");
      expect(result.error).not.toContain("constraint");
    }
  });
});

describe("discardWalk", () => {
  it("rejects unauthenticated callers", async () => {
    const supabase = makeSupabase({ user: null });
    const result = await discardWalk(WALK_ID);
    expect(result.ok).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("scopes the update to the caller's own walk (authz, not just walkId)", async () => {
    const walks = queryBuilder();
    makeSupabase({ tables: { walks: [walks] } });
    const result = await discardWalk(WALK_ID);
    expect(result.ok).toBe(true);
    expect(walks.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "discarded" })
    );
    expect(walks.eq).toHaveBeenCalledWith("id", WALK_ID);
    expect(walks.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

describe("completeWalk", () => {
  it("rejects unauthenticated callers before any DB read", async () => {
    const supabase = makeSupabase({ user: null });
    const result = await completeWalk(WALK_ID, VALID_LOOP);
    expect(result.ok).toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects a walk the caller does not own (ownership scoped in the select)", async () => {
    const walkSelect = queryBuilder({ data: null, error: null });
    const supabase = makeSupabase({ tables: { walks: [walkSelect] } });
    const result = await completeWalk(WALK_ID, VALID_LOOP);
    expect(result.ok).toBe(false);
    expect(walkSelect.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects a walk that is already completed (no double claim)", async () => {
    const supabase = makeSupabase({
      tables: {
        walks: [queryBuilder({ data: { id: WALK_ID, status: "completed" }, error: null })],
      },
    });
    const result = await completeWalk(WALK_ID, VALID_LOOP);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("already finished");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid polygon without calling the RPC or completing the walk", async () => {
    const walkSelect = queryBuilder({ data: { id: WALK_ID, status: "in_progress" }, error: null });
    const supabase = makeSupabase({ tables: { walks: [walkSelect] } });
    const result = await completeWalk(WALK_ID, SELF_INTERSECTING);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("crossed your own path");
    expect(supabase.rpc).not.toHaveBeenCalled();
    // The walk must NOT be marked completed on a failed claim
    expect(walkSelect.update).not.toHaveBeenCalled();
  });

  it("rejects malformed client payloads (garbage coordinates) gracefully", async () => {
    const supabase = makeSupabase({
      tables: {
        walks: [queryBuilder({ data: { id: WALK_ID, status: "in_progress" }, error: null })],
      },
    });
    const garbage = [[77.59, 12.97], ["evil", "input"], [77.6, 12.98]] as unknown as Array<[number, number]>;
    const result = await completeWalk(WALK_ID, garbage);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("scrambled");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns a generic error and does not complete the walk when the RPC fails", async () => {
    const walkSelect = queryBuilder({ data: { id: WALK_ID, status: "in_progress" }, error: null });
    const walkUpdate = queryBuilder();
    makeSupabase({
      tables: { walks: [walkSelect, walkUpdate] },
      rpcResult: { data: null, error: { message: "function claim_territory does not exist" } },
    });
    const result = await completeWalk(WALK_ID, VALID_LOOP);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Failed to save territory. Try again.");
      expect(result.error).not.toContain("claim_territory");
    }
    expect(walkUpdate.update).not.toHaveBeenCalled();
    expect(updateTag).not.toHaveBeenCalled();
  });

  it("claims territory, completes the walk, and invalidates caches on success", async () => {
    const walkSelect = queryBuilder({ data: { id: WALK_ID, status: "in_progress" }, error: null });
    const walkUpdate = queryBuilder();
    const RIVAL = "99999999-9999-9999-9999-999999999999";
    const lossEvents = queryBuilder({
      data: [
        { affected_owner_id: RIVAL, area_delta_m2: -1200 },
        { affected_owner_id: RIVAL, area_delta_m2: -800 },
      ],
      error: null,
    });
    const supabase = makeSupabase({
      tables: { walks: [walkSelect, walkUpdate], territory_events: [lossEvents] },
      rpcResult: {
        data: { territory_id: TERRITORY_ID, clipped_count: 2, lost_count: 1 },
        error: null,
      },
    });

    const result = await completeWalk(WALK_ID, VALID_LOOP);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.territoryId).toBe(TERRITORY_ID);
      expect(result.clippedCount).toBe(2);
      expect(result.lostCount).toBe(1);
      expect(result.mergedCount).toBe(0); // legacy RPC shape defaults to 0
      expect(result.areaM2).toBeGreaterThan(500);
    }

    // RPC called with the authenticated user as owner - never client input
    expect(supabase.rpc).toHaveBeenCalledWith(
      "claim_territory",
      expect.objectContaining({ p_owner_id: USER_ID, p_walk_id: WALK_ID })
    );

    // Walk marked completed with the recorded path and walked distance
    expect(walkUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        path: VALID_LOOP,
        distance_m: expect.any(Number),
      })
    );
    const updatePayload = walkUpdate.update.mock.calls[0][0] as { distance_m: number };
    // ~1.1 km per side, 3 sides traced (the loop closes server-side)
    expect(updatePayload.distance_m).toBeGreaterThan(3000);
    expect(updatePayload.distance_m).toBeLessThan(4000);

    // Read-your-own-writes cache invalidation
    expect(revalidatePath).toHaveBeenCalledWith("/map");
    expect(updateTag).toHaveBeenCalledWith("leaderboard");

    // Affected owners get push-notified with their per-event losses
    expect(notifyTerritoryLoss).toHaveBeenCalledWith("A rival walker", [
      { ownerId: "99999999-9999-9999-9999-999999999999", areaLostM2: 1200 },
      { ownerId: "99999999-9999-9999-9999-999999999999", areaLostM2: 800 },
    ]);
  });

  it("prefers the server-computed area over the client-side turf area (self-overlap merge)", async () => {
    const walkSelect = queryBuilder({ data: { id: WALK_ID, status: "in_progress" }, error: null });
    const walkUpdate = queryBuilder();
    makeSupabase({
      tables: { walks: [walkSelect, walkUpdate] },
      rpcResult: {
        data: {
          territory_id: TERRITORY_ID,
          clipped_count: 0,
          lost_count: 0,
          merged_count: 2,
          area_m2: 2_500_000, // merged territory is bigger than the walked loop
        },
        error: null,
      },
    });

    const result = await completeWalk(WALK_ID, VALID_LOOP);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.areaM2).toBe(2_500_000);
      expect(result.mergedCount).toBe(2);
    }
    // Nobody was clipped - no notification round-trip
    expect(notifyTerritoryLoss).not.toHaveBeenCalled();
  });
});
