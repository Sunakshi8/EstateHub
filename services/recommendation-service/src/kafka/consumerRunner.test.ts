// Verifies the ResilientConsumer guarantees (retry, DLQ, poison messages,
// unknown types, never-lose-a-message) against a fake kafkajs.
import { randomUUID } from "node:crypto";
import type { Kafka } from "kafkajs";
import { describe, expect, it, vi } from "vitest";
import { NonRetryableError, ResilientConsumer } from "../shared/consumerRunner";

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

type EachMessage = (p: unknown) => Promise<void>;

function fakeKafka(opts: { dlqFails?: boolean } = {}) {
  let each: EachMessage = async () => undefined;
  const sent: { topic: string; messages: { headers: Record<string, string> }[] }[] = [];
  const consumer = {
    on: vi.fn(), events: { CRASH: "consumer.crash" },
    connect: async () => undefined, subscribe: async () => undefined, disconnect: async () => undefined,
    run: async (cfg: { eachMessage: EachMessage }) => { each = cfg.eachMessage; },
  };
  const producer = {
    connect: async () => undefined, disconnect: async () => undefined,
    send: async (r: (typeof sent)[number]) => { if (opts.dlqFails) throw new Error("dlq down"); sent.push(r); },
  };
  const kafka = { consumer: () => consumer, producer: () => producer } as unknown as Kafka;
  const deliver = (value: string) =>
    each({ topic: "estatehub.interactions", partition: 2, heartbeat: async () => undefined,
           message: { offset: "42", key: Buffer.from("u1"), value: Buffer.from(value) } });
  return { kafka, deliver, sent };
}

const goodEvent = () =>
  JSON.stringify({
    eventId: randomUUID(), type: "property.viewed", version: 1, occurredAt: new Date().toISOString(),
    producer: "t", data: { userId: "u1", propertyId: "p1" },
  });

async function start(handle: () => Promise<void>, k = fakeKafka(), maxAttempts = 3) {
  const c = new ResilientConsumer({
    kafka: k.kafka, logger, groupId: "g", topics: ["estatehub.interactions"],
    handle, maxAttempts, baseBackoffMs: 1,
  });
  await c.start();
  return { c, k };
}

describe("ResilientConsumer", () => {
  it("processes a valid event once", async () => {
    const handle = vi.fn(async () => undefined);
    const { c, k } = await start(handle);
    await k.deliver(goodEvent());
    expect(handle).toHaveBeenCalledTimes(1);
    expect(c.metrics.processed).toBe(1);
    expect(k.sent).toHaveLength(0);
  });

  it("retries transient failures and then succeeds without dead-lettering", async () => {
    let n = 0;
    const handle = vi.fn(async () => { if (++n < 3) throw new Error("db blip"); });
    const { c, k } = await start(handle);
    await k.deliver(goodEvent());
    expect(handle).toHaveBeenCalledTimes(3);
    expect(c.metrics.retried).toBe(2);
    expect(k.sent).toHaveLength(0);
  });

  it("dead-letters after exhausting retries, with diagnostic headers", async () => {
    const handle = vi.fn(async () => { throw new Error("always broken"); });
    const { c, k } = await start(handle);
    await k.deliver(goodEvent());
    expect(handle).toHaveBeenCalledTimes(3);
    expect(c.metrics.deadLettered).toBe(1);
    expect(k.sent[0].topic).toBe("estatehub.interactions.dlq");
    const h = k.sent[0].messages[0].headers;
    expect(h["dlq-reason"]).toBe("handler_failed");
    expect(h["dlq-error"]).toContain("always broken");
    expect(h["dlq-attempts"]).toBe("3");
    expect(h["dlq-source-partition"]).toBe("2");
    expect(h["dlq-source-offset"]).toBe("42");
  });

  it("does not retry NonRetryableError", async () => {
    const handle = vi.fn(async () => { throw new NonRetryableError("bad data"); });
    const { k } = await start(handle);
    await k.deliver(goodEvent());
    expect(handle).toHaveBeenCalledTimes(1);
    expect(k.sent).toHaveLength(1);
  });

  it("sends poison messages (bad JSON, schema violations) straight to the DLQ", async () => {
    const handle = vi.fn(async () => undefined);
    const { k } = await start(handle);
    await k.deliver("{not json");
    await k.deliver(JSON.stringify({ type: "property.viewed", data: {} }));
    expect(handle).not.toHaveBeenCalled();
    expect(k.sent.map((s) => s.messages[0].headers["dlq-reason"])).toEqual(["invalid_json", "schema_violation"]);
  });

  it("skips unknown event types from newer producers instead of failing", async () => {
    const handle = vi.fn(async () => undefined);
    const { c, k } = await start(handle);
    await k.deliver(JSON.stringify({ type: "property.teleported", data: {} }));
    expect(handle).not.toHaveBeenCalled();
    expect(k.sent).toHaveLength(0);
    expect(c.metrics.skipped).toBe(1);
  });

  it("never loses a message: if the DLQ write fails, the error propagates so Kafka redelivers", async () => {
    const { k } = await start(async () => { throw new Error("nope"); }, fakeKafka({ dlqFails: true }));
    await expect(k.deliver(goodEvent())).rejects.toThrow("dlq down");
  });
});
