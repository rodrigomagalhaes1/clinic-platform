import { createServer } from "node:http";
import { createApp } from "./server.ts";

const port = Number(process.env.PORT ?? 3333);
const app = createApp();

const server = createServer((request, response) => {
  app.handle(request, response);
});

server.listen(port, () => {
  console.log(`Clinic Automation API running on http://localhost:${port}`);
});

