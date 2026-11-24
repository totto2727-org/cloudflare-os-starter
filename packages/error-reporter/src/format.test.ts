import { describe, expect, it } from "vitest";
import { formatErrorLog } from "./format.ts";

describe("formatErrorLog", () => {
  it("adds trusted producer metadata to the bounded event", () => {
    const event = {
      exception: { message: "boom", type: "Error" },
      failureSite: "overseer.run-agent",
      handled: false,
      occurredAt: "2026-08-04T00:00:00.000Z",
      occurrenceId: "occurrence-id",
      schemaVersion: 1 as const,
      severity: "error" as const,
    };

    expect(formatErrorLog({
      environment: "production",
      release: "abc123",
      service: "cloudflare-os",
    }, event)).toEqual({
      environment: "production",
      event: "error_report",
      release: "abc123",
      service: "cloudflare-os",
      ...event,
    });
  });

  it("does not let RPC input replace trusted metadata", () => {
    const event = {
      environment: "forged",
      event: "forged",
      failureSite: "site",
      handled: false,
      occurredAt: "2026-08-04T00:00:00.000Z",
      occurrenceId: "occurrence-id",
      release: "forged",
      schemaVersion: 1 as const,
      service: "forged",
      severity: "error" as const,
    };

    expect(formatErrorLog({
      environment: "production",
      release: "abc123",
      service: "cloudflare-os",
    }, event)).toMatchObject({
      environment: "production",
      event: "error_report",
      release: "abc123",
      service: "cloudflare-os",
    });
  });
});
