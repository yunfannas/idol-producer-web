import { htmlEsc } from "./htmlEsc";
import type { UiLanguage } from "./i18n";
import { ZH_WIKI_TERM_OVERRIDES } from "./wikiTerms.zh";

export interface WikiEntry {
  key: string;
  label: string;
  summary: string;
  description: string;
  aliases: string[];
}

function enEntries(): WikiEntry[] {
  return [
    {
      key: "inbox",
      label: "Inbox",
      summary: "Your queue for reports, blockers, and live-start prompts.",
      description:
        "Inbox collects operational messages. Anything that blocks time progression, like a same-day live start or a contract decision, will surface here first.",
      aliases: ["Inbox"],
    },
    {
      key: "training",
      label: "Training",
      summary: "Set workload, focus, and song preparation for each idol.",
      description:
        "Training controls singing, dance, physical work, and target focus. It is where you protect condition while still improving ability and song familiarity.",
      aliases: ["Training", "training plan", "Assignments"],
    },
    {
      key: "schedule",
      label: "Schedule",
      summary: "Calendar view for lives, results, and media appearances.",
      description:
        "Schedule combines booked managed lives, completed results, and official media appearances so you can plan around busy weeks and upcoming obligations.",
      aliases: ["Schedule", "calendar"],
    },
    {
      key: "live",
      label: "Live",
      summary: "A booked performance for your managed group.",
      description:
        "Lives are the core revenue and exposure loop. They create attendance, fan gain, morale shifts, fatigue, and post-show sales opportunities.",
      aliases: ["Live Start", "booked lives", "live", "lives"],
    },
    {
      key: "tokutenkai",
      label: "Tokutenkai",
      summary: "Post-show cheki or talk-ticket session.",
      description:
        "Tokutenkai happens after a live and sells member interaction tickets. It can add significant revenue, but it also extends the working day for the roster.",
      aliases: ["tokutenkai", "cheki", "talk tickets"],
    },
    {
      key: "goods",
      label: "Goods",
      summary: "Physical merch inventory sold at eligible lives.",
      description:
        "Goods are items you produce in Making and sell at supported live formats. Stock, pricing, and the live type all affect how much merch revenue you can actually realize.",
      aliases: ["goods", "merch", "goods booth"],
    },
    {
      key: "setlist",
      label: "Setlist",
      summary: "The song order and running program for a live.",
      description:
        "A setlist defines which songs and segments happen on stage. Reusing songs improves familiarity, while the program length and type shape the event flow.",
      aliases: ["setlist", "running order", "program"],
    },
    {
      key: "shortlist",
      label: "Shortlist",
      summary: "Tracked idols you may want to sign later.",
      description:
        "Shortlisted idols are scouting targets you want to keep in view. They remain candidates until you convert them into an actual signing process.",
      aliases: ["shortlist", "shortlisted"],
    },
    {
      key: "scout",
      label: "Scout",
      summary: "Discover freelancers, transfers, and auditions.",
      description:
        "Scout is where you find roster upgrades. Different sources expose different lead quality, costs, and signing conditions.",
      aliases: ["Scout", "audition", "freelancers", "transfer targets"],
    },
    {
      key: "fans",
      label: "Fans",
      summary: "Audience size backing the group and individual members.",
      description:
        "Fans represent reach and support. Higher fan counts improve turnout assumptions, group momentum, and some downstream financial expectations.",
      aliases: ["fans", "fan count", "attendance"],
    },
    {
      key: "condition",
      label: "Condition",
      summary: "Short-term physical readiness for work.",
      description:
        "Condition drops when idols train hard or work long lives. Low condition makes the roster harder to schedule efficiently and raises performance risk.",
      aliases: ["condition"],
    },
    {
      key: "morale",
      label: "Morale",
      summary: "Short-term motivation and emotional state.",
      description:
        "Morale reflects how well idols are coping with current work. It influences contract discussions and can move with results, workload, and internal events.",
      aliases: ["morale"],
    },
    {
      key: "taiban",
      label: "Taiban",
      summary: "Shared-bill live with multiple groups on the lineup.",
      description:
        "Taiban is a multi-group event where your set is shorter than a one-man. It is useful for exposure and lower-commitment booking, but usually offers less control than a full concert.",
      aliases: ["Taiban", "taiban"],
    },
    {
      key: "concert",
      label: "Concert",
      summary: "A larger headline-style managed live.",
      description:
        "Concert is the heavier self-hosted format. It typically carries larger setup, pricing, and revenue assumptions than routine or shared-bill lives.",
      aliases: ["Concert", "concert", "one-man"],
    },
    {
      key: "festival",
      label: "Festival",
      summary: "A festival appearance imported from the loaded catalog.",
      description:
        "Festival appearances are catalog-driven external events. They matter for exposure, scheduling pressure, and managed live planning around existing commitments.",
      aliases: ["Festival", "festival"],
    },
    {
      key: "finances",
      label: "Finances",
      summary: "Your operating cash view and cost/revenue breakdown.",
      description:
        "Finances tracks ticket sales, goods, tokutenkai income, wages, and fixed operating costs. It is the main check on whether your current strategy is sustainable.",
      aliases: ["Finances", "cash on hand", "ticket price"],
    },
  ];
}

function zhEntries(): WikiEntry[] {
  const entries: WikiEntry[] = [
    {
      key: "inbox",
      label: "收件箱",
      summary: "汇总报告、阻塞事项和演出开始提示。",
      description: "收件箱是运营消息入口。凡是会阻止时间继续推进的事情，例如当天演出开始或合同确认，都会先出现在这里。",
      aliases: ["收件箱", "Inbox"],
    },
    {
      key: "training",
      label: "训练",
      summary: "给成员安排训练负荷、重点和练习曲。",
      description: "训练界面控制唱功、舞蹈、体能和目标训练，也负责推进歌曲熟练度。它的核心是在提升能力和保护状态之间找平衡。",
      aliases: ["训练", "训练安排", "Training", "Assignments"],
    },
    {
      key: "schedule",
      label: "日程",
      summary: "查看演出、结果和媒体行程的总日历。",
      description: "日程会把已排演出、已完成结果和官方媒体活动合在一起，方便你看清忙周和空档。",
      aliases: ["日程", "日历", "Schedule", "calendar"],
    },
    {
      key: "live",
      label: "演出",
      summary: "你为当前团安排的实际演出。",
      description: "演出是核心循环。它会带来出勤、涨粉、士气变化、疲劳和会后销售机会。",
      aliases: ["演出", "开始演出", "Live Start", "live", "lives"],
    },
    {
      key: "tokutenkai",
      label: "特典会",
      summary: "演出后的 cheki 或交流券环节。",
      description: "特典会通常在演出后进行，通过交流券或 cheki 产生额外收入，但也会显著拉长成员工作时长。",
      aliases: ["特典会", "チェキ", "cheki", "tokutenkai"],
    },
    {
      key: "goods",
      label: "周边",
      summary: "可在支持物販的演出中销售的实体周边库存。",
      description: "周边需要先在制作里做出来，再带去支持物販的演出售卖。库存、价格和演出类型都会影响最终收入。",
      aliases: ["周边", "物販", "goods", "goods booth", "merch"],
    },
    {
      key: "setlist",
      label: "歌单",
      summary: "演出的歌曲顺序和节目流程。",
      description: "歌单决定舞台上演什么歌、如何排序以及穿插什么段落。它会影响演出长度和歌曲熟练度推进。",
      aliases: ["歌单", "流程", "setlist", "running order", "program"],
    },
    {
      key: "shortlist",
      label: "候选名单",
      summary: "你暂时重点跟进、以后可能签下的偶像。",
      description: "候选名单是星探目标池。成员进入候选名单后，表示你准备继续观察或推进签约。",
      aliases: ["候选名单", "候选", "shortlist", "shortlisted"],
    },
    {
      key: "scout",
      label: "星探",
      summary: "寻找自由人、转会目标和试镜候选人。",
      description: "星探用来补强阵容。不同来源的候选人质量、成本和签约难度都不同。",
      aliases: ["星探", "试镜", "自由人", "转会目标", "Scout", "audition", "freelancers", "transfer targets"],
    },
    {
      key: "fans",
      label: "粉丝",
      summary: "支持组合和成员的受众规模。",
      description: "粉丝代表受众基础。更高的粉丝数会改善到场预期、组合势头以及部分财务推算。",
      aliases: ["粉丝", "粉丝数", "到场", "fans", "fan count", "attendance"],
    },
    {
      key: "condition",
      label: "状态",
      summary: "成员当前的身体状态。",
      description: "状态会被重训练和长时间演出拉低。状态差会让排班更难，也会提高演出风险。",
      aliases: ["状态", "condition"],
    },
    {
      key: "morale",
      label: "士气",
      summary: "成员短期的情绪和积极性。",
      description: "士气反映成员当前对工作节奏的接受度。它会影响合同讨论，也会随着结果和负荷波动。",
      aliases: ["士气", "morale"],
    },
    {
      key: "taiban",
      label: "拼盘",
      summary: "多团共演的拼盘演出。",
      description: "拼盘是多组同台的 shared-bill 演出。你能获得曝光，但演出时长和掌控度通常不如 one-man。",
      aliases: ["拼盘", "对盘", "Taiban", "taiban"],
    },
    {
      key: "concert",
      label: "公演",
      summary: "更重型的主打 managed live。",
      description: "公演通常比 routine 或拼盘投入更高，票价、配置和收益预期也更高。",
      aliases: ["公演", "单独公演", "Concert", "concert", "one-man"],
    },
    {
      key: "festival",
      label: "音乐节",
      summary: "从已载入目录同步进来的音乐节出演。",
      description: "音乐节出演是外部活动，会影响曝光和排期，也会和你自己的 managed live 互相挤压时间。",
      aliases: ["音乐节", "Festival", "festival"],
    },
    {
      key: "finances",
      label: "财务",
      summary: "查看现金流和各项成本收入。",
      description: "财务会追踪票房、周边、特典会、工资和固定运营成本，是判断当前策略能否持续的核心界面。",
      aliases: ["财务", "现金", "票价", "Finances", "cash on hand", "ticket price"],
    },
  ];
  const overrideMap = new Map(ZH_WIKI_TERM_OVERRIDES.map((entry) => [entry.key, entry] as const));
  return entries.map((entry) => {
    const override = overrideMap.get(entry.key);
    if (!override) return entry;
    return {
      ...entry,
      label: override.label || entry.label,
      aliases: override.aliases.length ? override.aliases : entry.aliases,
    };
  });
}

export function wikiEntries(lang: UiLanguage): WikiEntry[] {
  return lang === "zh-CN" ? zhEntries() : enEntries();
}

export function defaultWikiEntryKey(lang: UiLanguage): string {
  return wikiEntries(lang)[0]?.key ?? "inbox";
}

export function renderWikiPanel(lang: UiLanguage, selectedKey: string | null, browseMode: boolean): string {
  const entries = wikiEntries(lang);
  const selected = entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null;
  const label = lang === "zh-CN" ? "游戏百科" : "Wiki";
  const browseHint =
    lang === "zh-CN"
      ? "点击主界面中的高亮术语，或从下面的词条列表中选择。"
      : "Click highlighted terms in the main view, or choose an entry below.";
  const emptyHint = lang === "zh-CN" ? "暂无词条。" : "No wiki entries yet.";
  const list = entries.length
    ? entries
        .map((entry) => {
          const active = selected?.key === entry.key ? " is-active" : "";
          return `<button type="button" class="wiki-entry-btn${active}" data-wiki-term="${htmlEsc(entry.key)}">
            <span class="wiki-entry-btn__label">${htmlEsc(entry.label)}</span>
            <span class="wiki-entry-btn__summary">${htmlEsc(entry.summary)}</span>
          </button>`;
        })
        .join("")
    : `<p class="wiki-panel__empty">${htmlEsc(emptyHint)}</p>`;

  return `
  <section class="fm-wiki" aria-labelledby="wiki-heading">
    <h2 id="wiki-heading" class="fm-wiki-label">${htmlEsc(label)}</h2>
    <div class="fm-wiki-card">
      ${
        selected
          ? `<article class="wiki-panel__article${browseMode ? " is-browse" : ""}">
              <h3 class="wiki-panel__title">${htmlEsc(selected.label)}</h3>
              <p class="wiki-panel__summary">${htmlEsc(selected.summary)}</p>
              <p class="wiki-panel__description">${htmlEsc(selected.description)}</p>
              <p class="wiki-panel__hint">${htmlEsc(browseHint)}</p>
            </article>`
          : `<p class="wiki-panel__empty">${htmlEsc(emptyHint)}</p>`
      }
      <div class="wiki-panel__list" role="list">${list}</div>
    </div>
  </section>`;
}

function shouldSkipWikiAnnotation(node: Node | null): boolean {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement) {
      if (
        current.matches("button, a, input, textarea, select, option, code, pre, script, style") ||
        current.closest("[data-wiki-skip]")
      ) {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function aliasMap(lang: UiLanguage): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of wikiEntries(lang)) {
    for (const alias of entry.aliases) {
      const key = alias.trim().toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, entry.key);
    }
  }
  return map;
}

export function annotateWikiTerms(root: HTMLElement, lang: UiLanguage): void {
  const byAlias = aliasMap(lang);
  const aliases = [...byAlias.keys()].sort((a, b) => b.length - a.length);
  if (!aliases.length) return;
  const pattern = aliases
    .map((alias) => {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return /^[a-z0-9][a-z0-9 -]*$/i.test(alias) ? `\\b${escaped}\\b` : escaped;
    })
    .join("|");
  if (!pattern) return;
  const regex = new RegExp(pattern, "gi");
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current instanceof Text && current.nodeValue && current.nodeValue.trim() && !shouldSkipWikiAnnotation(current.parentNode)) {
      textNodes.push(current);
    }
    current = walker.nextNode();
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? "";
    regex.lastIndex = 0;
    if (!regex.test(text)) continue;
    regex.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const match of text.matchAll(regex)) {
      const raw = match[0];
      const index = match.index ?? 0;
      const key = byAlias.get(raw.toLowerCase());
      if (!key) continue;
      if (index > cursor) frag.append(document.createTextNode(text.slice(cursor, index)));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wiki-term-button";
      button.dataset.wikiTerm = key;
      button.textContent = raw;
      frag.append(button);
      cursor = index + raw.length;
    }
    if (cursor < text.length) frag.append(document.createTextNode(text.slice(cursor)));
    textNode.parentNode?.replaceChild(frag, textNode);
  }
}
