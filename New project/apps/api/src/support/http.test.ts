import { describe, it, expect } from "vitest";
import { BadRequestError, PayloadTooLargeError, parseJsonBody } from "./http.js";
import { IncomingMessage } from "node:http";
import { Readable } from "node:stream";

// ---------------------------------------------------------------------------
// Helper: build a minimal IncomingMessage from a string body
// ---------------------------------------------------------------------------
function makeRequest(body: string): IncomingMessage {
  const readable = Readable.from([body]) as unknown as IncomingMessage;
  return readable;
}

function makeEmptyRequest(): IncomingMessage {
  const readable = Readable.from([]) as unknown as IncomingMessage;
  return readable;
}

// ---------------------------------------------------------------------------
// BadRequestError
// ---------------------------------------------------------------------------

describe("BadRequestError", () => {
  it("is an instance of Error", () => {
    const err = new BadRequestError("oops");
    expect(err).toBeInstanceOf(Error);
  });

  it("has name BadRequestError", () => {
    expect(new BadRequestError("x").name).toBe("BadRequestError");
  });

  it("preserves the message", () => {
    expect(new BadRequestError("Invalid JSON body").message).toBe("Invalid JSON body");
  });

  it("is distinguishable from generic Error", () => {
    const err: unknown = new BadRequestError("test");
    expect(err instanceof BadRequestError).toBe(true);
    expect(err instanceof Error).toBe(true);

    const generic: unknown = new Error("test");
    expect(generic instanceof BadRequestError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseJsonBody
// ---------------------------------------------------------------------------

describe("parseJsonBody", () => {
  it("parses a valid JSON object", async () => {
    const req = makeRequest(JSON.stringify({ fullName: "Ana Lima", phone: "11999990000" }));
    const result = await parseJsonBody(req);
    expect(result.fullName).toBe("Ana Lima");
    expect(result.phone).toBe("11999990000");
  });

  it("returns empty object for an empty body", async () => {
    const req = makeEmptyRequest();
    const result = await parseJsonBody(req);
    expect(result).toEqual({});
  });

  it("throws BadRequestError for invalid JSON", async () => {
    const req = makeRequest("{ not valid json }");
    await expect(parseJsonBody(req)).rejects.toBeInstanceOf(BadRequestError);
  });

  it("BadRequestError message describes the problem", async () => {
    const req = makeRequest("!!!");
    try {
      await parseJsonBody(req);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestError);
      expect((err as BadRequestError).message).toBe("Invalid JSON body");
    }
  });

  it("parses nested objects", async () => {
    const req = makeRequest(JSON.stringify({ patient: { id: "pat_1", tags: ["vip"] } }));
    const result = await parseJsonBody(req);
    expect((result.patient as Record<string, unknown>).id).toBe("pat_1");
  });

  it("parses arrays at top level", async () => {
    const req = makeRequest(JSON.stringify([1, 2, 3]));
    // JSON.parse("[1,2,3]") returns an array, cast to JsonRecord is valid
    const result = await parseJsonBody(req);
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws PayloadTooLargeError when the body exceeds maxBytes", async () => {
    const req = makeRequest(JSON.stringify({ note: "x".repeat(100) }));
    await expect(parseJsonBody(req, 10)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("accepts a body within a custom maxBytes limit", async () => {
    const req = makeRequest(JSON.stringify({ a: 1 }));
    const result = await parseJsonBody(req, 1024);
    expect(result.a).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PayloadTooLargeError
// ---------------------------------------------------------------------------

describe("PayloadTooLargeError", () => {
  it("is an instance of Error", () => {
    expect(new PayloadTooLargeError("too big")).toBeInstanceOf(Error);
  });

  it("has name PayloadTooLargeError", () => {
    expect(new PayloadTooLargeError("too big").name).toBe("PayloadTooLargeError");
  });

  it("preserves the message", () => {
    expect(new PayloadTooLargeError("Request body must not exceed 10 bytes").message).toBe(
      "Request body must not exceed 10 bytes"
    );
  });
});
