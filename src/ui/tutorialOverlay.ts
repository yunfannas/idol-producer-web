import type { DesktopNavId } from "./gameShell";
import { htmlEsc } from "./htmlEsc";
import { navLabel, type UiLanguage } from "./i18n";

export interface TutorialStep {
  view: DesktopNavId | null;
  title: string;
  body: string;
  bullets: string[];
}

export interface TutorialOverlayRenderArgs {
  lang: UiLanguage;
  stepIndex: number;
  autoOpenEnabled: boolean;
}

export function tutorialMenuLabel(lang: UiLanguage): string {
  return lang === "zh-CN" ? "教程" : "Tutorial";
}

export function tutorialAutoOpenLabel(lang: UiLanguage): string {
  return lang === "zh-CN"
    ? "新游戏时自动打开此教程"
    : "Open this tutorial automatically for new games";
}

export function tutorialSteps(lang: UiLanguage): TutorialStep[] {
  if (lang === "zh-CN") {
    return [
      {
        view: null,
        title: "欢迎接手事务所",
        body: "这套引导会按实际游玩顺序带你熟悉管理界面。完成后可以随时从首页菜单重新打开。",
        bullets: [
          "顶部的“下一步”会推进到当天的下一个事件，或在没有事件时推进到次日 08:00。",
          "现金、日期和存档操作都固定在顶栏，方便随时查看。",
        ],
      },
      {
        view: "Inbox",
        title: "先处理收件箱里的必处理事项",
        body: "每天先查看收件箱。关键通知、演出开始提示和运营报告都会在这里出现。",
        bullets: [
          "需要确认的消息会阻止时间继续推进，直到你处理完成。",
          "开局时的成员概览、近期演出和员工简报也会先出现在这里。",
        ],
      },
      {
        view: "Training",
        title: "在训练中安排日常培养",
        body: "训练界面用来给成员分配唱功、舞蹈、体能和目标训练，并指定重点练习歌曲。",
        bullets: [
          "成员页可以按能力、状态、年龄和士气排序。",
          "训练分配页适合每周检查负荷，避免在高强度演出周前把状态压得太低。",
        ],
      },
      {
        view: "Schedule",
        title: "用日程统筹周历和月历",
        body: "日程会把你管理的演出、已结算结果和官方媒体安排放到同一条时间线上。",
        bullets: [
          "双击某一天可以把周视图固定到那一天。",
          "月历上的标记会区分已排期演出、已完成演出和媒体活动。",
        ],
      },
      {
        view: "Lives",
        title: "在公演中排期并开演",
        body: "公演界面负责建立新演出、安排节目单、设置周边和特典会，并从已排期列表正式开演。",
        bullets: [
          "公演、拼盘、常规公演和音乐节会带出不同的默认设置。",
          "VIP、特典会和周边会直接影响收入与成员负担。",
        ],
      },
      {
        view: "Songs",
        title: "管理歌曲与制作内容",
        body: "歌曲界面用来查看曲库和发行目录；制作界面负责单曲、专辑和实体周边。",
        bullets: [
          "歌曲熟练度会随着训练安排和演出使用逐步提升。",
          "要先在制作里做出周边库存，之后才能在公演中销售。",
        ],
      },
      {
        view: "Scout",
        title: "通过发掘补强阵容",
        body: "发掘界面用来跟进自由人、转籍目标和试镜候选人，在现有阵容不足时补强成员。",
        bullets: [
          "候选名单会显示在左侧边栏，方便你随时回看目标成员。",
          "签约结果会受到成员资料、士气和你给出的条件影响。",
        ],
      },
      {
        view: "Finances",
        title: "在财务中检查现金流",
        body: "财务会把票房、周边、特典会、工资和固定成本集中起来，方便判断当前策略能否持续。",
        bullets: [
          "演出规模、票价和周边选择都会直接反映到每日收支。",
          "正式推进几天后，记得先检查现金消耗速度，再决定是否继续扩张。",
        ],
      },
    ];
  }

  return [
    {
      view: null,
      title: "Welcome to the production office",
      body: "This walkthrough follows the normal first-week loop so a new save explains itself. You can reopen it later from the Home menu.",
      bullets: [
        "The NEXT button advances to the next event today, or to 08:00 tomorrow when the day is clear.",
        "Cash, date, and save controls stay in the top bar for quick checks.",
      ],
    },
    {
      view: "Inbox",
      title: "Start with Inbox",
      body: "Inbox is where blocking decisions, live starts, and operations reports arrive. It is the safest first stop each day.",
      bullets: [
        "Messages that require confirmation will stop time progression until you handle them.",
        "Opening-week roster, live, and staff briefings are seeded here when a new game starts.",
      ],
    },
    {
      view: "Training",
      title: "Set the training plan",
      body: "Training is where you manage singing, dance, physical work, target focus, and the songs your group is actively preparing.",
      bullets: [
        "The roster tab helps you sort by ability, condition, morale, age, and tenure.",
        "Assignments are the place to keep workload sensible before heavy live weeks.",
      ],
    },
    {
      view: "Schedule",
      title: "Use Schedule as your calendar",
      body: "Schedule combines your managed lives, completed live results, and official media appearances into one planning view.",
      bullets: [
        "Double-click a day to anchor the week strip there.",
        "The month view marks booked lives, completed lives, and media items separately.",
      ],
    },
    {
      view: "Lives",
      title: "Build and run lives",
      body: "Lives covers booking, setlists, goods, tokutenkai, and the actual live-start workflow for your managed group.",
      bullets: [
        "Concert, Taiban, Routine, and Festival presets seed different defaults.",
        "VIP, tokutenkai, and goods choices all feed directly into revenue and member fatigue.",
      ],
    },
    {
      view: "Songs",
      title: "Manage songs and production",
      body: "Songs shows the playable catalog and discography. Making handles CDs and physical goods for future sales.",
      bullets: [
        "Song familiarity improves through training and live use.",
        "Goods must exist in stock before you can sell them from the Lives screen.",
      ],
    },
    {
      view: "Scout",
      title: "Scout for roster upgrades",
      body: "Scout is where you pursue freelancers, transfer targets, and auditions when your current lineup is not enough.",
      bullets: [
        "Your shortlist stays visible in the left sidebar for quick follow-up.",
        "Contract outcomes depend on the idol profile, morale, and the offer you make.",
      ],
    },
    {
      view: "Finances",
      title: "Watch the money",
      body: "Finances is the reality check. It rolls ticket income, goods, tokutenkai, payroll, and operating costs into one view.",
      bullets: [
        "Live scale, pricing, and goods selection all change the daily cash result.",
        "After a few simulated days, check burn rate before you expand staffing or scouting.",
      ],
    },
  ];
}

export function renderTutorialOverlay({ lang, stepIndex, autoOpenEnabled }: TutorialOverlayRenderArgs): string {
  const steps = tutorialSteps(lang);
  const safeIndex = Math.max(0, Math.min(stepIndex, steps.length - 1));
  const step = steps[safeIndex] ?? steps[0]!;
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === steps.length - 1;
  const stepCounter =
    lang === "zh-CN"
      ? `第 ${safeIndex + 1} / ${steps.length} 步`
      : `Step ${safeIndex + 1} of ${steps.length}`;
  const openLabel = step.view ? navLabel(lang, step.view) : null;
  const openViewLabel =
    lang === "zh-CN"
      ? `打开 ${openLabel ?? ""}`
      : `Open ${openLabel ?? ""}`;

  return `
<div class="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
  <div class="tutorial-overlay__backdrop" data-tutorial-close="1"></div>
  <section class="tutorial-overlay__panel">
    <div class="tutorial-overlay__header">
      <div>
        <p class="tutorial-overlay__eyebrow">${htmlEsc(stepCounter)}</p>
        <h2 class="tutorial-overlay__title" id="tutorial-title">${htmlEsc(step.title)}</h2>
      </div>
      <button type="button" class="tutorial-overlay__close" aria-label="${htmlEsc(lang === "zh-CN" ? "关闭教程" : "Close tutorial")}" data-tutorial-close="1">x</button>
    </div>
    <p class="tutorial-overlay__body">${htmlEsc(step.body)}</p>
    <ul class="tutorial-overlay__list">
      ${step.bullets.map((item) => `<li>${htmlEsc(item)}</li>`).join("")}
    </ul>
    <div class="tutorial-overlay__footer">
      <label class="tutorial-overlay__toggle">
        <input type="checkbox" id="tutorial-auto-open-toggle" ${autoOpenEnabled ? "checked" : ""} />
        <span>${htmlEsc(tutorialAutoOpenLabel(lang))}</span>
      </label>
      <div class="tutorial-overlay__actions">
        ${step.view ? `<button type="button" class="fm-btn" data-tutorial-nav="${htmlEsc(step.view)}">${htmlEsc(openViewLabel)}</button>` : ""}
        <button type="button" class="fm-btn" data-tutorial-back="1" ${isFirst ? "disabled" : ""}>${htmlEsc(lang === "zh-CN" ? "上一步" : "Back")}</button>
        <button type="button" class="fm-btn fm-btn-accent" data-tutorial-next="1">${htmlEsc(isLast ? (lang === "zh-CN" ? "完成" : "Finish") : lang === "zh-CN" ? "下一步" : "Next")}</button>
      </div>
    </div>
  </section>
</div>`;
}
