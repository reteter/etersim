import { describe, expect, it } from "vitest";
import { projectToViewBox } from "./mapProjection";

describe("projectToViewBox", () => {
  it("maps 0 to the padding offset", () => {
    expect(projectToViewBox(0, 100, 10)).toBe(10);
  });

  it("maps 1 to size minus padding", () => {
    expect(projectToViewBox(1, 100, 10)).toBe(90);
  });

  it("maps 0.5 to the center regardless of padding", () => {
    expect(projectToViewBox(0.5, 100, 10)).toBe(50);
    expect(projectToViewBox(0.5, 200, 30)).toBe(100);
  });
});
