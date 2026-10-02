import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import { once } from "node:events";
import { createHandler } from "../server/app";
import { catalog, type Catalog } from "../shared";

const largeCatalog: Catalog = {
  ...catalog,
  tracks: Array.from({ length: 30 }, (_, index) => ({
    ...catalog.tracks[index % 2],
    id: `track-${index}`,
    name: `Track ${String(index).padStart(3, "0")}`,
  })),
  fixtures: Array.from({ length: 120 }, (_, index) => ({
    ...catalog.fixtures[index % 3],
    id: `fixture-${index}`,
    name: `Fixture ${String(index).padStart(3, "0")}`,
    price: 100 + index,
  })),
};
test("REST API paginates a large injected catalog and calculates authoritative prices", async () => {
  const server = http.createServer(createHandler(largeCatalog));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const first = await (await fetch(`${base}/api/fixtures?pageSize=6`)).json();
    const second = await (
      await fetch(`${base}/api/fixtures?pageSize=6&page=2`)
    ).json();
    assert.equal(first.total, 120);
    assert.equal(first.items.length, 6);
    assert.equal(first.pages, 20);
    assert.equal(
      first.items.some((item: { id: string }) =>
        second.items.some((next: { id: string }) => next.id === item.id),
      ),
      false,
    );
    const search = await (
      await fetch(`${base}/api/fixtures?q=Fixture%20010`)
    ).json();
    assert.equal(search.total, 1);
    assert.equal(search.items[0].id, "fixture-10");
    const filtered = await (
      await fetch(`${base}/api/tracks?category=recessed&pageSize=10`)
    ).json();
    assert.equal(filtered.total, 15);
    assert.ok(
      filtered.items.every(
        (item: { mount: string }) => item.mount === "recessed",
      ),
    );
    assert.equal((await fetch(`${base}/api/fixtures/missing`)).status, 404);
    assert.equal((await fetch(`${base}/api/fixtures?page=-1`)).status, 400);
    assert.equal(
      (await fetch(`${base}/api/fixtures?pageSize=999`)).status,
      400,
    );
    assert.equal((await fetch(`${base}/api/fixtures/fixture-10`)).status, 200);
    const response = await fetch(`${base}/api/quote`, {
      method: "POST",
      body: JSON.stringify({
        tracks: [
          {
            productId: "track-0",
            length: 2,
            fixtures: [{ type: "fixture-10", price: 1 }],
          },
        ],
      }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(
      result.items.find((item: { kind: string }) => item.kind === "fixture")
        .unitPrice,
      110,
    );
    assert.equal(
      (await fetch(`${base}/api/quote`, { method: "POST", body: "{" })).status,
      400,
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
