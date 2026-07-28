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
      key: "group",
      label: "Group",
      summary: "An idol unit with its own roster, fanbase, songs, and history.",
      description:
        "A group is the main operating unit in the game. Group pages help you track members, releases, popularity, and where a unit sits in the market.",
      aliases: ["Group", "group", "Groups"],
    },
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
      key: "songs",
      label: "Songs",
      summary: "The playable catalog tied to each group.",
      description:
        "Songs are the base material for releases and live setlists. The Songs and Making screens split released tracks from in-production work depending on the current reference date.",
      aliases: ["Songs", "songs", "song"],
    },
    {
      key: "discography",
      label: "Discography",
      summary: "Release-oriented view of a group’s catalog.",
      description:
        "Discography groups tracks into releases so you can inspect singles, albums, and the broader release timeline instead of only song rows.",
      aliases: ["Discography", "discography", "CD", "single", "album"],
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
      key: "media",
      label: "Media",
      summary: "Official appearances outside the managed live list.",
      description:
        "Media covers TV, radio, online, books, and external appearances pulled from official schedule data. It gives you a forward view of publicity pressure and member commitments.",
      aliases: ["Media", "media", "TV", "Radio", "Online", "Books", "Live Events"],
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
        "Scout is where you find roster upgrades. Different sources expose different lead quality, costs, and signing conditions. Open Career Decision recruit windows are pinned into Scout leads so you can divert historical destinations by signing first.",
      aliases: ["Scout", "audition", "freelancers", "transfer targets"],
    },
    {
      key: "career_decision",
      label: "Career Decision",
      summary: "Historical member exits and contested recruit windows you can override.",
      description:
        "Career Decisions use history as the default path. Locked graduations always fire. Negotiable outbound transfers use Departure decision inbox notices that open 5 weeks before the historical leave date (keep / allow leave); retaining suppresses the historical leave and destination join. Contested recruits stay on the Scout → shortlist → signing-offer path — sign them during the open window to change who they join.",
      aliases: ["Career Decision", "transfer", "graduation", "retain", "recruit window", "Departure decision"],
    },
    {
      key: "scandal_handling",
      label: "Scandal Handling",
      summary: "When a managed member's scandal becomes public, you choose the operational response.",
      description:
        "Scandals arrive as scheduled status events. When you manage the affected group, Scandal handling is a gameplay decision with real costs: cash (PR), group/idol fans, teammate morale, salary cuts, role demotion, activity suspension (hiatus / off-stage), roster exit timing, and timed live/sales form penalties. Each group has Reputation (1-5, default 3) and its agency has Harshness (1-5) — e.g. iLiFE! reputation 2 under Imaginate harshness 5 — which reshape soft-keep vs firm-cut scores. Reputation is dynamic: starting values are interpolated from historical tenure (including past members) and past scandals/handlings (curated anchors override), then slowly rises with accrued member tenure and well-handled graduations (a special/farewell live near the leave), and falls with scandals + their handling (soft keeps hurt most; timed suspend-then-return −0.5) and core members leaving without recognition. Scenario 6 cases include iLiFE! at Budokan (那蘭のどか terminate after live; 心花りり keep with heavy penalty via leader demotion) and 高嶺のなでしこ: 春野莉々 (indefinite suspension from May, then a major leave decision on 2025-07-31 before any return date) vs 籾山ひめり (suspend for some time, return 2026-02-14). =LOVE and アキシブproject have no post-start member scandal in the historical timeline.",
      aliases: ["Scandal", "scandal handling", "terminate", "demote", "leader demotion", "规约违反"],
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
      key: "league",
      label: "League",
      summary: "HEROINES League standings and schedule for HEROINES openings.",
      description:
        "HEROINES League is the collective's seasonal ranking series (League I / II, then FINAL and promotion). The League tab under Lives shows current-season tables, upcoming dates, and History finals (e.g. 24-25 総入れ替え戦). For HEROINES openings your arrangement goal is: stay safe in League I and avoid 入れ替え戦, or if you fall in, recover to finish top 4 and survive. Lineup, setlist, training, and scheduling should move those standings.",
      aliases: ["League", "league", "HEROINES League", "入れ替え戦", "昇格戦", "総入れ替え戦"],
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
      key: "group",
      label: "组合",
      summary: "拥有成员、粉丝、歌曲和历史沿革的偶像团体单位。",
      description: "组合是游戏里的主要经营单位。组合页面用来查看成员构成、发行目录、人气和整体市场位置。",
      aliases: ["组合", "团体", "Group", "Groups"],
    },
    {
      key: "inbox",
      label: "收件箱",
      summary: "汇总报告、必处理事项和演出开始提示。",
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
      key: "songs",
      label: "歌曲",
      summary: "归属于各组合、可用于发行和公演的歌曲目录。",
      description: "歌曲是发行和节目单的基础内容。歌曲与制作页面会按照当前参考日期，把已发行和制作中的内容拆开显示。",
      aliases: ["歌曲", "歌", "Songs", "song"],
    },
    {
      key: "discography",
      label: "作品目录",
      summary: "按发行物而不是单曲行查看组合作品。",
      description: "作品目录会把歌曲整理进单曲、专辑等发行物中，方便你从发行时间线而不是单独歌曲条目的角度查看内容。",
      aliases: ["作品目录", "发行目录", "Discography", "CD", "single", "album"],
    },
    {
      key: "live",
      label: "演出",
      summary: "你为当前团安排的实际演出。",
      description: "演出是核心循环。它会带来出勤、涨粉、士气变化、疲劳和会后销售机会。",
      aliases: ["演出", "开始演出", "Live Start", "live", "lives"],
    },
    {
      key: "media",
      label: "通告",
      summary: "不属于自主管理公演列表的官方外部曝光行程。",
      description: "通告涵盖电视、广播、网络、书刊和外部出演等官方行程数据，方便你提前判断宣传压力和成员档期占用。",
      aliases: ["通告", "媒体", "电视", "广播", "网络", "书刊", "Media", "TV", "Radio", "Online", "Books", "Live Events"],
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
      summary: "可在支持物贩的演出中销售的实体周边库存。",
      description: "周边需要先在制作里做出来，再带去支持物贩的演出售卖。库存、价格和演出类型都会影响最终收入。",
      aliases: ["周边", "物贩", "goods", "goods booth", "merch"],
    },
    {
      key: "setlist",
      label: "节目单",
      summary: "演出的歌曲顺序和节目流程。",
      description: "节目单决定舞台上演什么歌、如何排序以及穿插什么段落。它会影响演出长度和歌曲熟练度推进。",
      aliases: ["节目单", "歌单", "流程", "setlist", "running order", "program"],
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
      description:
        "星探用来补强阵容。不同来源的候选人质量、成本和签约难度都不同。开放中的生涯决定招募窗口会置顶进星探线索，抢先签约可改写历史去向。",
      aliases: ["星探", "试镜", "自由人", "转会目标", "Scout", "audition", "freelancers", "transfer targets"],
    },
    {
      key: "career_decision",
      label: "生涯决定",
      summary: "可用玩家选择改写的历史离团与争夺招募窗口。",
      description:
        "生涯决定以历史路径为默认。锁定毕业总会发生。可协商的外流转会在历史离团日前 5 周打开「离团决定」收件箱（挽留 / 允许离团）；挽留会压制历史离团与目标团入团。争夺招募仍走星探→候选名单→签约提案——在窗口期内签约即可改写她加入的团体。",
      aliases: ["生涯决定", "转会", "毕业", "挽留", "招募窗口", "离团决定", "Career Decision"],
    },
    {
      key: "scandal_handling",
      label: "丑闻处理",
      summary: "经营团成员丑闻曝光时，由你决定运营应对。",
      description:
        "丑闻作为日程状态事件到达。经营团时「丑闻处理」是带真实代价的玩法选择：公关现金、组合/个人粉丝、队友士气、降薪、职位降格、活动休止（停演/休止）、离团时机，以及一段时间的演出/物贩表现惩罚。每个组合有声誉 Reputation（1-5，默认 3），所属事务所有严厉度 Harshness（1-5）——例如 iLiFE! 声誉 2、Imaginate 严厉度 5——会改变软性留任与强硬切割的评分。声誉是动态的：初始值由历史年资（含过往成员）与过往丑闻/处理插值得到（策展锚点可覆盖）；开局后随成员在团年资累积、以及处理得当的毕业（离团前后有专场/毕业公演）而缓慢上升；随丑闻及其处理（软性留任伤害最大；限期休止复归 −0.5）、核心成员无仪式离团而下降。情景 6 包含 iLiFE! 武道馆事件（那兰のどか演出后脱退；心花りり以领袖降格作为重罚留任）、高嶺のなでしこ・春野莉々（5 月无期限休止后，在未设定复归日前于 2025-07-31 离团——经营团时为重大决定）与籾山ひめり（限期休止，2026-02-14 复归）；=LOVE 与アキシブproject在开局后没有史实成员丑闻。",
      aliases: ["丑闻", "丑闻处理", "解约", "降格", "领袖降格", "Scandal", "scandal handling"],
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
      key: "league",
      label: "联赛",
      summary: "HEROINES 联赛积分榜与赛程（仅 HEROINES 开局可见）。",
      description:
        "HEROINES League 是集体内的赛季排名系列（League I / II，之后是 FINAL 与升降级）。在 Live 的联赛页可查看当前赛季积分榜、即将场次，以及 History 历史决赛（如 24-25 总入れ替え戦）。HEROINES 开局的排期目标是：稳住 League I、尽量避开入れ替え戦；若掉进升降级，则力争前四保级/升回 I。阵容、歌单、训练与排期应能拉动这些名次。",
      aliases: ["联赛", "League", "league", "HEROINES League", "入れ替え戦", "昇格戦", "総入れ替え戦"],
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

export function relatedWikiKeysForView(view: string, browseMode: boolean): string[] {
  const browseMap: Record<string, string[]> = {
    // Keep "group" off Idols so membership labels ("Group" / "组合") are not wiki-annotated;
    // group names navigate to the in-app group summary instead.
    Idols: ["fans", "condition", "morale"],
    Groups: ["group", "fans", "songs", "discography"],
    Songs: ["songs", "discography", "group"],
  };
  const managementMap: Record<string, string[]> = {
    Inbox: ["inbox", "live", "scout", "shortlist", "career_decision", "scandal_handling"],
    Idols: ["fans", "condition", "morale", "training", "career_decision", "scandal_handling"],
    Groups: ["group", "fans", "songs", "discography"],
    Songs: ["songs", "discography", "group"],
    Scout: ["scout", "shortlist", "career_decision", "fans", "condition", "morale"],
    Training: ["training", "condition", "morale", "songs"],
    Schedule: ["schedule", "live", "media", "festival"],
    Media: ["media", "schedule", "fans"],
    Finances: ["finances", "live", "goods", "tokutenkai"],
    Making: ["songs", "discography", "goods"],
    Lives: ["live", "setlist", "tokutenkai", "goods", "concert", "taiban", "festival", "league"],
  };
  const keys = (browseMode ? browseMap : managementMap)[view] ?? ["group"];
  return [...new Set(keys)];
}

export function defaultWikiEntryKeyForView(lang: UiLanguage, view: string, browseMode: boolean): string {
  const allowed = new Set(relatedWikiKeysForView(view, browseMode));
  return wikiEntries(lang).find((entry) => allowed.has(entry.key))?.key ?? defaultWikiEntryKey(lang);
}

export function normalizeWikiSelection(
  lang: UiLanguage,
  view: string,
  browseMode: boolean,
  selectedKey: string | null,
): string {
  const allowed = new Set(relatedWikiKeysForView(view, browseMode));
  if (selectedKey && allowed.has(selectedKey)) return selectedKey;
  return defaultWikiEntryKeyForView(lang, view, browseMode);
}

export function renderWikiPanel(lang: UiLanguage, selectedKey: string | null, browseMode: boolean, view: string): string {
  const allowed = new Set(relatedWikiKeysForView(view, browseMode));
  const entries = wikiEntries(lang).filter((entry) => allowed.has(entry.key));
  const selected = entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null;
  const label = lang === "zh-CN" ? "\u6e38\u620f\u767e\u79d1" : "Wiki";
  const browseHint =
    lang === "zh-CN"
      ? "点击主界面里的高亮术语，或从下方相关词条中切换。"
      : "Click highlighted terms in the main view, or switch from the related topics below.";
  const emptyHint = lang === "zh-CN" ? "当前页面没有相关词条。" : "No related wiki topics for this view.";
  const relatedLabel = lang === "zh-CN" ? "相关词条" : "Related";
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
      <div class="wiki-panel__topics">
        <h3 class="wiki-panel__topics-label">${htmlEsc(relatedLabel)}</h3>
        <div class="wiki-panel__list" role="list">${list}</div>
      </div>
    </div>
  </section>`;
}

export function renderFullWikiPanel(lang: UiLanguage, selectedKey: string | null): string {
  const entries = wikiEntries(lang);
  const selected = entries.find((entry) => entry.key === selectedKey) ?? entries[0] ?? null;
  const label = lang === "zh-CN" ? "????" : "Wiki";
  const list = entries
    .map((entry) => {
      const active = selected?.key === entry.key ? " is-active" : "";
      return `<button type="button" class="wiki-entry-btn${active}" data-wiki-term="${htmlEsc(entry.key)}">
        <span class="wiki-entry-btn__label">${htmlEsc(entry.label)}</span>
        <span class="wiki-entry-btn__summary">${htmlEsc(entry.summary)}</span>
      </button>`;
    })
    .join("");

  return `
  <section class="fm-wiki" aria-labelledby="wiki-heading">
    <h2 id="wiki-heading" class="fm-wiki-label">${htmlEsc(label)}</h2>
    <div class="fm-wiki-card">
      ${
        selected
          ? `<article class="wiki-panel__article">
              <h3 class="wiki-panel__title">${htmlEsc(selected.label)}</h3>
              <p class="wiki-panel__summary">${htmlEsc(selected.summary)}</p>
              <p class="wiki-panel__description">${htmlEsc(selected.description)}</p>
            </article>`
          : ""
      }
      <div class="wiki-panel__topics">
        <h3 class="wiki-panel__topics-label">${htmlEsc(lang === "zh-CN" ? "å…¨éƒ¨è¯æ¡" : "All topics")}</h3>
        <div class="wiki-panel__list" role="list">${list}</div>
      </div>
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

function aliasMap(lang: UiLanguage, allowedKeys?: readonly string[] | null): Map<string, string> {
  const map = new Map<string, string>();
  const allowed = allowedKeys?.length ? new Set(allowedKeys) : null;
  for (const entry of wikiEntries(lang)) {
    if (allowed && !allowed.has(entry.key)) continue;
    for (const alias of entry.aliases) {
      const key = alias.trim().toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, entry.key);
    }
  }
  return map;
}

export function annotateWikiTerms(root: HTMLElement, lang: UiLanguage, allowedKeys?: readonly string[] | null): void {
  const byAlias = aliasMap(lang, allowedKeys);
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

