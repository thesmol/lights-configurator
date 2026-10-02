import http from "node:http";
import { createHandler } from "./app.js";
const port = Number(process.env.API_PORT) || 8787;
http
  .createServer(createHandler())
  .listen(port, "0.0.0.0", () =>
    console.log("Catalog API listening on port", port),
  );
