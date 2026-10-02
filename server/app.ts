import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import {
  catalog as demoCatalog,
  quote,
  type Catalog,
  type LightProduct,
  type TrackProduct,
} from "../shared.js";
import { queryCatalog, type CatalogQuery } from "../domain/catalogQuery.js";

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
};
const mime: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
function parseQuery(params: URLSearchParams): CatalogQuery {
  const integer = (key: string, fallback: number, maximum: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 1 || value > maximum)
      throw new Error(`Недопустимый параметр ${key}`);
    return value;
  };
  const sort = params.get("sort") ?? "name";
  if (sort !== "name" && sort !== "price-asc" && sort !== "price-desc")
    throw new Error("Недопустимая сортировка");
  const q = params.get("q") ?? "";
  if (q.length > 200) throw new Error("Слишком длинный поисковый запрос");
  return {
    q,
    category: params.get("category") ?? "",
    page: integer("page", 1, 1000000),
    pageSize: integer("pageSize", 6, 50),
    sort,
  };
}
/** The catalog is injected so a database adapter can replace the demo snapshot. */
export function createHandler(
  catalog: Catalog = demoCatalog,
  dist = resolve(process.cwd(), "dist"),
) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;
    if (path.startsWith("/api/")) {
      try {
        if (req.method === "GET" && path === "/api/health")
          return json(res, 200, { ok: true });
        if (req.method === "GET" && path === "/api/catalog")
          return json(res, 200, catalog);
        if (req.method === "GET" && path === "/api/layouts")
          return json(res, 200, catalog.layouts);
        const collection = /^\/api\/(tracks|fixtures)(?:\/([^/]+))?$/.exec(
          path,
        );
        if (req.method === "GET" && collection) {
          const items =
            collection[1] === "tracks" ? catalog.tracks : catalog.fixtures;
          if (collection[2]) {
            const item = items.find(
              (item) => item.id === decodeURIComponent(collection[2]),
            );
            return item
              ? json(res, 200, item)
              : json(res, 404, { error: "Товар не найден" });
          }
          return json(
            res,
            200,
            queryCatalog<LightProduct | TrackProduct>(
              items,
              parseQuery(url.searchParams),
            ),
          );
        }
        if (req.method === "POST" && path === "/api/quote") {
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (Buffer.byteLength(body) > 64000)
              return json(res, 413, { error: "Слишком большой запрос" });
          }
          return json(res, 200, quote(JSON.parse(body), catalog));
        }
        return json(res, 404, { error: "Маршрут не найден" });
      } catch (error) {
        return json(res, 400, {
          error:
            error instanceof SyntaxError
              ? "Некорректный JSON"
              : error instanceof Error
                ? error.message
                : "Недопустимый запрос",
        });
      }
    }
    if (req.method === "GET") {
      try {
        const filename = resolve(
          dist,
          decodeURIComponent(path).replace(/^\/+/, "") || "index.html",
        );
        if (!filename.startsWith(dist + "/"))
          return json(res, 403, { error: "Доступ запрещён" });
        const content = await readFile(filename);
        res.writeHead(200, {
          "content-type": mime[extname(filename)] ?? "application/octet-stream",
        });
        return res.end(content);
      } catch {
        if (!extname(path)) {
          try {
            const html = await readFile(resolve(dist, "index.html"));
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            return res.end(html);
          } catch {
            /* No build available. */
          }
        }
      }
    }
    json(res, 404, { error: "Не найдено" });
  };
}
