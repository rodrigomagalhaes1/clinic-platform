import type { IncomingMessage, ServerResponse } from "node:http";

type JsonRecord = Record<string, unknown>;

export function json(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Clinic-Id",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
  });
  response.end(JSON.stringify(payload, dateReplacer, 2));
}

export function created(response: ServerResponse, payload: unknown) {
  return json(response, 201, { data: payload });
}

export function deleted(response: ServerResponse) {
  response.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Clinic-Id",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
  });
  response.end();
}

export function noContent(response: ServerResponse) {
  response.writeHead(204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Clinic-Id",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS"
  });
  response.end();
}

export function badRequest(response: ServerResponse, message: string) {
  return json(response, 400, {
    error: {
      code: "bad_request",
      message
    }
  });
}

export function notFound(response: ServerResponse) {
  return json(response, 404, {
    error: {
      code: "not_found",
      message: "Route not found"
    }
  });
}

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

export class PayloadTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadTooLargeError";
  }
}

export function payloadTooLarge(response: ServerResponse, message: string) {
  return json(response, 413, {
    error: {
      code: "payload_too_large",
      message
    }
  });
}

const MAX_BODY_BYTES = 1024 * 1024;

export async function parseJsonBody(request: IncomingMessage, maxBytes = MAX_BODY_BYTES): Promise<JsonRecord> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw new PayloadTooLargeError(`Request body must not exceed ${maxBytes} bytes`);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    throw new BadRequestError("Invalid JSON body");
  }
}

function dateReplacer(_key: string, value: unknown) {
  return value instanceof Date ? value.toISOString() : value;
}
