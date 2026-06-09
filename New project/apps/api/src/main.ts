import { createServer } from "node:http";
import { createApp } from "./server.ts";
import { config } from "./config.ts";
import { log, withRequestLogging } from "./support/logger.ts";

const app = createApp();

const server = createServer(withRequestLogging((request, response) => app.handle(request, response)));

server.listen(config.port, () => {
  log("info", "server started", {
    port: config.port,
    database: config.databasePath,
    env: config.env
  });
});
