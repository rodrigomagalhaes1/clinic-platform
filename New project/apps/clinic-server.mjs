import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { createApp } from "./api/src/server.ts";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const webRoot = join(projectRoot, "apps", "web");
const port = Number(process.env.PORT ?? 5173);
const api = createApp();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${port}`);

  if (url.pathname === "/health" || url.pathname.startsWith("/v1")) {
    api.handle(request, response);
    return;
  }

  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(webRoot, requestedPath));

  if (!filePath.startsWith(webRoot) || !existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    "Cache-Control": "no-store"
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`Clinic Automation running on http://localhost:${port}`);
});

