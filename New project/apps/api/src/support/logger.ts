import type { IncomingMessage, ServerResponse } from "node:http";

export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, message: string, fields?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields
  };
  process.stdout.write(JSON.stringify(entry) + "\n");
}

export function withRequestLogging(
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    const startedAt = Date.now();
    const method = req.method ?? "GET";
    const url = req.url ?? "/";

    await handler(req, res);

    const durationMs = Date.now() - startedAt;
    log("info", "request", {
      method,
      url,
      status: res.statusCode,
      durationMs
    });
  };
}
