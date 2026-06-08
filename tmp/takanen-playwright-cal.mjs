import { chromium } from "playwright";
import fs from "node:fs";

const start = "2025-07-01";
const end = "2026-08-01";
const out = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const captured = [];

page.on("response", async (res) => {
  const url = res.url();
  if (!/admin-ajax|eventorganiser|fullcal/i.test(url)) return;
  try {
    const body = await res.text();
    captured.push({ url, status: res.status(), body: body.slice(0, 5000) });
  } catch {}
});

await page.goto("https://takanenonadeshiko.jp/schedule/", { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(5000);

// try clicking prev month buttons to load historical data
for (let i = 0; i < 14; i++) {
  const prev = page.locator(".fc-prev-button, .eo-fullcalendar-prev, button[aria-label*='前'], .fc-button-prev").first();
  if (await prev.count()) {
    await prev.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);
  }
}

const domEvents = await page.evaluate(() => {
  const rows = [];
  for (const el of document.querySelectorAll(".fc-event, .eo-event, a[href*='/events/event/']")) {
    const title = el.textContent?.trim();
    const href = el.getAttribute("href") || el.querySelector("a")?.getAttribute("href") || "";
    const date = el.getAttribute("data-date") || el.closest("[data-date]")?.getAttribute("data-date") || "";
    if (title) rows.push({ title, href, date });
  }
  return rows;
});

fs.writeFileSync(
  "tmp/takanen-playwright-cal.json",
  JSON.stringify({ captured, domEvents, capturedCount: captured.length, domCount: domEvents.length }, null, 2),
  "utf8",
);
console.log("captured", captured.length, "dom", domEvents.length);
for (const c of captured) console.log(c.status, c.url.slice(0, 120));

await browser.close();
