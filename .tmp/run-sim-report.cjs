const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addMonthsIso(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

function saveKey(account) {
  return `ip-web-save-v2-account-${encodeURIComponent(account.toLowerCase())}-slot-10`;
}

function num(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function isoPart(value) {
  return String(value || "").split("T")[0] || "2020-01-01";
}

function loadScenarioGroups() {
  const filePath = path.join(process.cwd(), "public/data/scenarios/scenario_6/groups.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function findScenarioStartGroup(groups, groupNeedle) {
  return (
    groups.find((row) => {
      const text = [row.name, row.name_romanji, row.nickname].map((value) => String(value || "")).join("\t");
      return text.includes(groupNeedle);
    }) || {}
  );
}

async function getAutosave(page, account) {
  return page.evaluate(async (key) => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("idol-producer-web-saves", 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction("slotPayloads", "readonly");
      const store = tx.objectStore("slotPayloads");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  }, saveKey(account));
}

async function currentIso(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const text = buttons.map((b) => b.textContent || "").find((t) => /\w+, \w+ \d{1,2}, \d{4}/.test(t)) || "";
    const parsed = new Date(`${text} UTC`);
    return Number.isNaN(parsed.valueOf()) ? "" : parsed.toISOString().slice(0, 10);
  });
}

async function currentDisplay(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.map((b) => (b.textContent || "").trim()).find((t) => /\w+, \w+ \d{1,2}, \d{4}/.test(t)) || "";
  });
}

async function buttonSnapshot(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("button")).map((button) => ({
      text: (button.textContent || "").trim(),
      disabled: button.disabled,
      id: button.id || "",
    })),
  );
}

async function clickButtonById(page, id) {
  return page.evaluate((targetId) => {
    const button = document.getElementById(targetId);
    if (!button || button.disabled) return false;
    button.click();
    return true;
  }, id);
}

async function clickButtonByText(page, patternSource) {
  return page.evaluate((source) => {
    const pattern = new RegExp(source);
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((row) => pattern.test((row.textContent || "").trim()) && !row.disabled);
    if (!button) return false;
    button.click();
    return true;
  }, patternSource);
}

async function clickUnreadInboxItem(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((row) => /^\*/.test((row.textContent || "").trim()) && !row.disabled);
    if (!button) return false;
    button.click();
    return true;
  });
}

async function loginAndStart(page, account, groupNeedle) {
  await page.goto("http://127.0.0.1:4173/");
  await page.waitForTimeout(2500);
  const nameInput = page.getByPlaceholder("Enter account name");
  if (await nameInput.count()) {
    await nameInput.fill(account);
    await page.getByRole("button", { name: "Log in" }).click();
  }
  await page.getByRole("button", { name: "New Game" }).click();
  await page.waitForFunction(() => document.querySelectorAll("tr").length > 5, null, { timeout: 10000 });
  const rows = page.locator("tr");
  const rowCount = await rows.count();
  let selected = false;
  const seen = [];
  for (let i = 1; i < rowCount; i += 1) {
    const text = await rows.nth(i).innerText();
    seen.push(text);
    if (text.includes(groupNeedle)) {
      await rows.nth(i).click();
      selected = true;
      break;
    }
  }
  if (!selected) throw new Error(`Could not select group row for ${groupNeedle}; saw ${seen.slice(0, 8).join(" || ")}`);
  await page.getByRole("button", { name: "Start scenario" }).click();
  await page.waitForTimeout(1800);
}

async function simulateGroup(account, groupNeedle) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1700, height: 1600 } });
  try {
    await loginAndStart(page, account, groupNeedle);
    const startIso = await currentIso(page);
    const targetIso = addMonthsIso(startIso, 6);
    let lastDisplay = await currentDisplay(page);
    let staleCount = 0;

    for (let i = 0; i < 5000; i += 1) {
      const iso = await currentIso(page);
      const display = await currentDisplay(page);
      if (iso >= targetIso) break;
      if (display === lastDisplay) staleCount += 1;
      else {
        staleCount = 0;
        lastDisplay = display;
      }
      if (i % 25 === 0) console.error(`[${account}] step=${i} iso=${iso} display=${display} stale=${staleCount}`);
      if (staleCount > 0 && staleCount % 20 === 0) {
        const buttons = await buttonSnapshot(page);
        console.error(`[${account}] stale buttons ${display} :: ${JSON.stringify(buttons.slice(0, 40))}`);
      }

      if (await clickButtonByText(page, "Today'?s live schedule")) {
        console.error(`[${account}] open today's live schedule at ${iso}`);
        await sleep(500);
        continue;
      }

      if (await clickUnreadInboxItem(page)) {
        console.error(`[${account}] open unread inbox item at ${iso}`);
        await sleep(300);
        continue;
      }

      if (await clickButtonByText(page, "Live Start")) {
        console.error(`[${account}] live start at ${iso}`);
        await sleep(250);
        continue;
      }

      if (await clickButtonByText(page, "^Acknowledge$")) {
        console.error(`[${account}] acknowledge at ${iso}`);
        await sleep(200);
        continue;
      }

      if (await clickButtonByText(page, "^Confirm$")) {
        console.error(`[${account}] confirm at ${iso}`);
        await sleep(200);
        continue;
      }

      if (await clickButtonByText(page, "^Mark all read$")) {
        await sleep(120);
      }

      if (await clickButtonById(page, "btn-next-day")) {
        await sleep(220);
        continue;
      }

      if (staleCount > 30) {
        const buttons = await buttonSnapshot(page);
        console.error(`[${account}] stalled snapshot ${display} :: ${JSON.stringify(buttons.slice(0, 40))}`);
        throw new Error(`Stalled at ${display}: ${JSON.stringify(buttons.slice(0, 40))}`);
      }
      await sleep(250);
    }

    const save = await getAutosave(page, account);
    return { save, startIso, targetIso };
  } finally {
    await browser.close();
  }
}

function buildReport(save, startIso, targetIso) {
  const gid = String(save.managing_group_uid || "");
  const group = (save.database_snapshot.groups || []).find((row) => String(row.uid || "") === gid) || {};
  const startGroup = save.__startGroup || {};
  const liveRows = (save.lives?.results || []).filter(
    (row) =>
      String(row.group_uid || "") === gid &&
      isoPart(row.date || row.start_date) >= startIso &&
      isoPart(row.date || row.start_date) <= targetIso,
  );
  const totals = liveRows.reduce(
    (acc, row) => {
      acc.performance += num(row.performance_score);
      acc.satisfaction += num(row.audience_satisfaction);
      acc.attendance += num(row.attendance);
      acc.capacity += num(row.capacity);
      acc.fanGain += num(row.group_fan_gain);
      acc.gross += num(row.gross_yen);
      return acc;
    },
    { performance: 0, satisfaction: 0, attendance: 0, capacity: 0, fanGain: 0, gross: 0 },
  );
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map(String) : [];
  const members = (save.database_snapshot.idols || [])
    .filter((row) => memberUids.includes(String(row.uid || "")))
    .map((row) => ({
      name: String(row.name || row.uid || ""),
      fan_count: num(row.fan_count),
      condition: num(row.condition),
      morale: num(row.morale),
    }))
    .sort((a, b) => b.fan_count - a.fan_count);
  const topLive =
    [...liveRows].sort(
      (a, b) => num(b.group_fan_gain) - num(a.group_fan_gain) || num(b.performance_score) - num(a.performance_score),
    )[0] || null;
  return {
    group: String(save.managing_group || ""),
    start_date: startIso,
    end_date: targetIso,
    final_sim_date: isoPart(save.current_date),
    turns: num(save.turn_number),
    start: {
      fans: num(startGroup.fans),
      popularity: num(startGroup.popularity),
      cash_yen: num(save.__startCash),
    },
    end: {
      fans: num(group.fans),
      popularity: num(group.popularity),
      cash_yen: num(save.finances?.cash_yen),
    },
    delta: {
      fans: num(group.fans) - num(startGroup.fans),
      popularity: Math.round((num(group.popularity) - num(startGroup.popularity)) * 1000) / 1000,
      cash_yen: num(save.finances?.cash_yen) - num(save.__startCash),
    },
    live_summary: {
      live_count: liveRows.length,
      average_performance: liveRows.length ? totals.performance / liveRows.length : 0,
      average_satisfaction: liveRows.length ? totals.satisfaction / liveRows.length : 0,
      attendance_rate: totals.capacity > 0 ? totals.attendance / totals.capacity : 0,
      fan_gain_from_lives: totals.fanGain,
      gross_yen: totals.gross,
    },
    top_live: topLive
      ? {
          date: isoPart(topLive.date || topLive.start_date),
          title: String(topLive.title || topLive.live_type || "Live"),
          venue: String(topLive.venue || ""),
          performance_score: num(topLive.performance_score),
          audience_satisfaction: num(topLive.audience_satisfaction),
          attendance: num(topLive.attendance),
          capacity: num(topLive.capacity),
          group_fan_gain: num(topLive.group_fan_gain),
          gross_yen: num(topLive.gross_yen),
        }
      : null,
    top_members_by_fans: members.slice(0, 5),
    team_status: {
      average_condition: members.length ? members.reduce((sum, row) => sum + row.condition, 0) / members.length : 0,
      average_morale: members.length ? members.reduce((sum, row) => sum + row.morale, 0) / members.length : 0,
    },
  };
}

(async () => {
  const scenarioGroups = loadScenarioGroups();
  const arg = process.argv[2] || "both";
  const runsByArg = {
    takane: [{ account: "sim_takane_6m", groupNeedle: "Takane_no_Nadeshiko" }],
    ilife: [{ account: "sim_ilife_6m", groupNeedle: "iLiFE!\tiLiFE!" }],
    both: [
      { account: "sim_takane_6m", groupNeedle: "Takane_no_Nadeshiko" },
      { account: "sim_ilife_6m", groupNeedle: "iLiFE!\tiLiFE!" },
    ],
  };
  const runs = runsByArg[arg];
  if (!runs) throw new Error(`Unknown arg ${arg}`);
  const reports = [];
  for (const run of runs) {
    console.error("Running", run.account, run.groupNeedle);
    const { save, startIso, targetIso } = await simulateGroup(run.account, run.groupNeedle);
    const startGroup = findScenarioStartGroup(scenarioGroups, run.groupNeedle);
    save.__startGroup = {
      fans: num(startGroup.fans),
      popularity: num(startGroup.popularity),
    };
    save.__startCash = 20000000;
    reports.push(buildReport(save, startIso, targetIso));
  }
  console.log(JSON.stringify(reports, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
