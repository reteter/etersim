import { describe, expect, it } from "vitest";
import { resolvePolicy } from "./registry.ts";

describe("resolvePolicy", () => {
  it("resolves a known policy", () => {
    expect(resolvePolicy("doNothing", {}).name).toBe("doNothing");
  });

  it("rejects an unknown policy with a named error, not a silent undefined", () => {
    expect(() => resolvePolicy("notAPolicy", {})).toThrow(/Unknown policy "notAPolicy"/);
  });

  it("rejects Object.prototype member names rather than resolving them via prototype lookup (wave-check finding)", () => {
    expect(() => resolvePolicy("constructor", {})).toThrow(/Unknown policy "constructor"/);
    expect(() => resolvePolicy("__proto__", {})).toThrow(/Unknown policy "__proto__"/);
    expect(() => resolvePolicy("toString", {})).toThrow(/Unknown policy "toString"/);
  });
});
