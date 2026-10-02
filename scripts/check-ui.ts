import assert from "node:assert/strict";
import { chromium, type Page } from "playwright";
import { catalog, quote, type Catalog, type Project } from "../shared";
import { queryCatalog } from "../domain/catalogQuery";
const base = process.env.TEST_URL ?? "http://localhost:8788";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const errors: string[] = [];
const state = (page: Page) =>
  page.evaluate(
    () =>
      JSON.parse(
        localStorage.getItem("lights-prototype-v1") ?? "null",
      ) as Project,
  );
const waitQuote = (page: Page) =>
  page
    .getByRole("button", { name: "Скачать спецификацию" })
    .waitFor({ state: "visible" })
    .then(() =>
      page.waitForFunction(
        () =>
          !document.querySelector<HTMLButtonElement>(".primary-btn")?.disabled,
      ),
    );
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await waitQuote(page);
  await page.getByRole("button", { name: "План потолка" }).click();
  const firstFixture = await page
    .locator('.plan-fixture[data-fixture-id="1"]')
    .boundingBox();
  assert.ok(firstFixture);
  const railEnd = await page
    .locator('.rail-hit[data-segment-id="main"]')
    .evaluate((line) => {
      const svg = (line as SVGElement).ownerSVGElement!.getBoundingClientRect();
      const x1 = Number(line.getAttribute("x1")),
        x2 = Number(line.getAttribute("x2"));
      return {
        x: svg.x + x1 + (x2 - x1) * 0.96,
        y: svg.y + Number(line.getAttribute("y1")),
      };
    });
  await page.mouse.move(
    firstFixture.x + firstFixture.width / 2,
    firstFixture.y + firstFixture.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(railEnd.x, railEnd.y, { steps: 12 });
  await page.mouse.up();
  const reordered = (await state(page)).tracks[0].fixtures;
  assert.ok(
    reordered.find((f) => f.id === 1)!.t > reordered.find((f) => f.id === 3)!.t,
  );
  await page.locator("#plan-view").click({ position: { x: 20, y: 80 } });
  assert.equal((await state(page)).selectedFixture, null);

  await page
    .getByRole("button", { name: "Форма: Z-форма", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("lights-prototype-v1") ?? "{}")
        .tracks?.[0]?.layoutId === "z",
  );
  assert.equal(await page.locator(".rail-hit").count(), 3);
  assert.equal(await page.locator("#track-tail").count(), 1);
  await page
    .getByRole("button", { name: "Нижний отрезок", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Добавить LINE 48", exact: true })
    .click();
  await waitQuote(page);
  assert.equal(
    (await state(page)).tracks[0].fixtures.filter(
      (f) => f.segmentId === "bottom",
    ).length,
    1,
  );
  await page.screenshot({ path: "/tmp/lights-z-plan.png" });
  await page
    .getByRole("button", { name: "Добавить трек", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Выбрать Встроенный трек 48V" })
    .click();
  await page
    .getByRole("button", { name: "Добавить SPOT 48", exact: true })
    .click();
  await waitQuote(page);
  let current = await state(page);
  assert.equal(current.tracks.length, 2);
  assert.equal(current.tracks[0].fixtures.length, 4);
  assert.equal(current.tracks[1].fixtures.length, 1);
  assert.equal(current.tracks[1].productId, "recessed");
  const fixture = page.locator('.plan-fixture[data-track-id="2"]').first();
  await fixture.click();
  await page.keyboard.press("Delete");
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("lights-prototype-v1") ?? "{}")
        .tracks?.[1]?.fixtures.length === 0,
  );
  await page.reload();
  await waitQuote(page);
  current = await state(page);
  assert.equal(current.tracks.length, 2);
  assert.equal(current.tracks[0].layoutId, "z");
  await page.getByRole("button", { name: "3D-комната" }).click();
  await page.locator("#three-view canvas").waitFor();
  const originalCanvas = await page
    .locator("#three-view canvas")
    .elementHandle();
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/quote")) requests++;
  });
  const slider = page.locator("#track-length");
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await waitQuote(page);
  assert.ok(requests <= 2, `Quote requests were not debounced: ${requests}`);
  assert.equal(
    await originalCanvas?.evaluate(
      (node) => node === document.querySelector("#three-view canvas"),
    ),
    true,
  );
  await page.screenshot({ path: "/tmp/lights-multiple-3d.png" });
  await page.close();
  console.log(
    "PASS: shape parameters, segment fixtures, multiple tracks, deletion, persistence, quote debounce, stable WebGL canvas",
  );

  const large: Catalog = {
    ...catalog,
    tracks: [
      ...catalog.tracks,
      ...Array.from({ length: 30 }, (_, i) => ({
        ...catalog.tracks[i % 2],
        id: `track-${i}`,
        name: `Profile ${String(i).padStart(3, "0")}`,
      })),
    ],
    fixtures: [
      ...catalog.fixtures,
      ...Array.from({ length: 120 }, (_, i) => ({
        ...catalog.fixtures[i % 3],
        id: `fixture-${i}`,
        name: `Fixture ${String(i).padStart(3, "0")}`,
        price: 500 + i,
      })),
    ],
  };
  const catalogPage = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  catalogPage.on("pageerror", (error) => errors.push(error.message));
  await catalogPage.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/catalog") return route.fulfill({ json: large });
    if (url.pathname === "/api/quote")
      return route.fulfill({
        json: quote(route.request().postDataJSON(), large),
      });
    if (url.pathname === "/api/fixtures" || url.pathname === "/api/tracks") {
      const query = {
        q: url.searchParams.get("q") ?? "",
        category: url.searchParams.get("category") ?? "",
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: Number(url.searchParams.get("pageSize") ?? 6),
      };
      return route.fulfill({
        json: url.pathname.endsWith("fixtures")
          ? queryCatalog(large.fixtures, query)
          : queryCatalog(large.tracks, query),
      });
    }
    return route.continue();
  });
  await catalogPage.goto(base);
  await waitQuote(catalogPage);
  const picker = catalogPage.locator(
    '.catalog-picker[aria-label="Светильники"]',
  );
  await picker.scrollIntoViewIfNeeded();
  await picker.locator('.catalog[aria-busy="false"]').waitFor();
  assert.equal(await picker.locator(".product-card").count(), 6);
  const names = await picker.locator(".product-copy strong").allTextContents();
  await picker.getByRole("button", { name: "Далее" }).click();
  await picker.locator('.catalog[aria-busy="false"]').waitFor();
  assert.notDeepEqual(
    await picker.locator(".product-copy strong").allTextContents(),
    names,
  );
  await picker.getByRole("searchbox").fill("Fixture 119");
  await picker.locator('.catalog[aria-busy="false"]').waitFor();
  assert.equal(await picker.locator(".product-card").count(), 1);
  await picker
    .getByRole("button", { name: "Добавить Fixture 119", exact: true })
    .click();
  await waitQuote(catalogPage);
  assert.ok(
    (await state(catalogPage)).tracks[0].fixtures.some(
      (f) => f.type === "fixture-119",
    ),
  );
  await picker.getByRole("searchbox").fill("");
  await picker.locator('.catalog[aria-busy="false"]').waitFor();
  await catalogPage.screenshot({ path: "/tmp/lights-large-catalog.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 123 fixtures / 32 tracks, bounded product list, pagination, server search, custom product placement; no browser errors",
  );
} finally {
  await browser.close();
}
