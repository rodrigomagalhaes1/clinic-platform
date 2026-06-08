import { createServer } from "node:http";
import { createApp } from "./server.ts";
import { config } from "./config.ts";

const app = createApp();

const server = createServer((request, response) => {
  app.handle(request, response);
});

server.listen(config.port, () => {
  console.log(`Clinic Automation API running on http://localhost:${config.port}`);
  console.log(`Database: ${config.databasePath}`);
  console.log(`Environment: ${config.env}`);
});

