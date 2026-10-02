import { chromium } from "playwright";
import { DEFAULT_PROJECT } from "../src/project";
import type { Project } from "../shared";
const project: Project = {
  ...DEFAULT_PROJECT,
  roomW: 6,
  roomD: 5,
  activeTrackId: 1,
  activeSegmentId: "side",
  selectedFixture: null,
  tracks: [
    {
      ...DEFAULT_PROJECT.tracks[0],
      layoutId: "corner",
      length: 3,
      depth: 2,
      x: -0.7,
      z: -0.3,
      fixtures: [
        { id: 1, type: "spot", segmentId: "main", t: 0.18 },
        { id: 2, type: "wide", segmentId: "main", t: 0.5 },
        { id: 3, type: "spot", segmentId: "main", t: 0.82 },
        { id: 4, type: "line", segmentId: "side", t: 0.3 },
        { id: 5, type: "line", segmentId: "side", t: 0.7 },
      ],
    },
    {
      ...DEFAULT_PROJECT.tracks[0],
      id: 2,
      productId: "recessed",
      length: 2,
      x: 1.2,
      z: 1.4,
      fixtures: [
        { id: 1, type: "wide", segmentId: "main", t: 0.3 },
        { id: 2, type: "spot", segmentId: "main", t: 0.7 },
      ],
    },
  ],
};
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 1,
  });
  await page.addInitScript(
    (project) =>
      localStorage.setItem("lights-prototype-v1", JSON.stringify(project)),
    project,
  );
  await page.goto(process.env.TEST_URL ?? "http://localhost:8788");
  await page.waitForFunction(
    () => !document.querySelector<HTMLButtonElement>(".primary-btn")?.disabled,
  );
  await page.locator("#three-view canvas").waitFor();
  await page.evaluate(() => document.fonts.ready);
  // Show track controls and the beginning of the catalog while keeping the full room visible.
  await page
    .locator(".sidebar .section")
    .nth(1)
    .evaluate((section) => section.scrollIntoView({ block: "start" }));
  const canvas = await page.locator("#three-view canvas").boundingBox();
  if (canvas) {
    await page.mouse.move(
      canvas.x + canvas.width / 2,
      canvas.y + canvas.height / 2,
    );
    await page.mouse.wheel(0, 120);
  }
  await page.mouse.move(10, 10);
  await page.screenshot({ path: "preview-3d.png" });
  await page.getByRole("button", { name: "План потолка" }).click();
  await page.locator("#plan-view > svg").waitFor();
  await page.mouse.move(10, 10);
  await page.screenshot({ path: "preview.png" });
  console.log("Updated preview-3d.png and preview.png (1600×1100 desktop)");
} finally {
  await browser.close();
}
