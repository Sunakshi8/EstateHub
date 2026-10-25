// Runs only when TEST_DATABASE_URL points at a disposable PostgreSQL.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pgPool, runMigrations } from "../config/postgres";
import { buildEvent } from "./producer";
import { drainOutbox, enqueueOutbox, outboxDepth } from "./outbox";

describe.skipIf(!process.env.TEST_DATABASE_URL)("transactional outbox (PostgreSQL)", () => {
  beforeAll(async () => {
    await runMigrations();
    await runMigrations(); // idempotent
  });
  afterAll(async () => { await pgPool.end(); });
  beforeEach(async () => { await pgPool.query("TRUNCATE outbox_events"); });

  const evt = (n: number) => buildEvent("property.viewed", { userId: "u", propertyId: `p${n}` });

  it("parks events and drains them in order, exactly once", async () => {
    for (let i = 1; i <= 3; i++) await enqueueOutbox("estatehub.interactions", "u", evt(i));
    expect(await outboxDepth()).toBe(3);

    const delivered: string[] = [];
    const sent = await drainOutbox(async (row) => { delivered.push(row.payload.type === "property.viewed" ? row.payload.data.propertyId : ""); });
    expect(sent).toBe(3);
    expect(delivered).toEqual(["p1", "p2", "p3"]);
    expect(await outboxDepth()).toBe(0);
    expect(await drainOutbox(async () => { throw new Error("must not resend"); })).toBe(0);
  });

  it("stops at the first failure, keeps order, and records the error", async () => {
    for (let i = 1; i <= 3; i++) await enqueueOutbox("estatehub.interactions", "u", evt(i));
    let calls = 0;
    const sent = await drainOutbox(async () => {
      if (++calls === 2) throw new Error("broker down");
    });
    expect(sent).toBe(1);
    expect(await outboxDepth()).toBe(2);
    const failed = await pgPool.query("SELECT attempts, last_error FROM outbox_events WHERE attempts > 0");
    expect(failed.rows[0]).toMatchObject({ attempts: 1, last_error: "broker down" });
  });

  it("ignores duplicate event ids", async () => {
    const e = evt(1);
    await enqueueOutbox("estatehub.interactions", "u", e);
    await enqueueOutbox("estatehub.interactions", "u", e);
    expect(await outboxDepth()).toBe(1);
  });
});
