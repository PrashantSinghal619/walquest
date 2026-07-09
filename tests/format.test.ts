import { describe, it, expect } from "vitest";
import { formatAreaM2, formatClaimDate } from "../lib/format";

describe("formatAreaM2", () => {
  it("formats small areas as whole m² with grouping", () => {
    expect(formatAreaM2(17444.4752442482)).toBe("17,444 m²");
    expect(formatAreaM2(500)).toBe("500 m²");
  });

  it("switches to km² at one million m²", () => {
    expect(formatAreaM2(1_000_000)).toBe("1.00 km²");
    expect(formatAreaM2(2_500_000)).toBe("2.50 km²");
  });

  it("stays in m² just below the km² threshold", () => {
    expect(formatAreaM2(999_999)).toContain("m²");
  });

  it("handles zero", () => {
    expect(formatAreaM2(0)).toBe("0 m²");
  });
});

describe("formatClaimDate", () => {
  it("formats an ISO timestamp as an Indian-style short date", () => {
    expect(formatClaimDate("2026-07-02T14:51:18.371735+00:00")).toBe("2 Jul 2026");
  });

  it("returns 'unknown' for garbage input instead of throwing", () => {
    expect(formatClaimDate("not-a-date")).toBe("unknown");
    expect(formatClaimDate("")).toBe("unknown");
  });
});
