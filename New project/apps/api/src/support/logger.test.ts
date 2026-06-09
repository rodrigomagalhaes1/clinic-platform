import { describe, it, expect, vi, afterEach } from "vitest";
import { log, withRequestLogging } from "./logger.ts";
import type { IncomingMessage, ServerResponse } from "node:http";

describe("log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a JSON line to stdout", () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    log("info", "hello", { foo: "bar" });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("hello");
    expect(entry.foo).toBe("bar");
    expect(typeof entry.ts).toBe("string");
  });

  it("includes level and message without extra fields", () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    log("error", "something went wrong");

    const entry = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(entry.level).toBe("error");
    expect(entry.message).toBe("something went wrong");
  });
});

describe("withRequestLogging", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls the inner handler and logs the request", async () => {
    const lines: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });

    const req = { method: "GET", url: "/health" } as IncomingMessage;
    const res = { statusCode: 200 } as ServerResponse;

    const handler = vi.fn().mockResolvedValue(undefined);
    const wrapped = withRequestLogging(handler);

    await wrapped(req, res);

    expect(handler).toHaveBeenCalledWith(req, res);
    expect(lines.length).toBeGreaterThan(0);

    const entry = JSON.parse(lines[lines.length - 1]!) as Record<string, unknown>;
    expect(entry.message).toBe("request");
    expect(entry.method).toBe("GET");
    expect(entry.url).toBe("/health");
    expect(entry.status).toBe(200);
    expect(typeof entry.durationMs).toBe("number");
  });
});
