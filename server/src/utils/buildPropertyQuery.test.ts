import { describe, expect, it } from "vitest";
import { buildPropertyQuery } from "./buildPropertyQuery";

describe("buildPropertyQuery", () => {
  it("always restricts to approved listings", () => {
    expect(buildPropertyQuery({}).query.moderationStatus).toBe("approved");
  });

  it("escapes regex metacharacters in user input", () => {
    const { query } = buildPropertyQuery({ keyword: "a.*(b" });
    const re = (query.$or as { title: RegExp }[])[0].title;
    expect(re.test("a.*(b")).toBe(true);
    expect(re.test("aXXb")).toBe(false);
  });

  it("clamps pagination", () => {
    const r = buildPropertyQuery({ page: -4, limit: 9999 });
    expect(r.pageNum).toBe(1);
    expect(r.limitNum).toBe(50);
  });

  it("builds price range and sort", () => {
    const r = buildPropertyQuery({ minPrice: "100", maxPrice: 500, sort: "price_desc" });
    expect(r.query.price).toEqual({ $gte: 100, $lte: 500 });
    expect(r.sortOption).toEqual({ price: -1 });
  });
});
