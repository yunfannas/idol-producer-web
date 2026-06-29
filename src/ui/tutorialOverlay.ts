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
        body: "这套引导会按实际游玩顺序带你熟悉管理界面。完成后可以随时从 Home 菜单重新打开。",
        bullets: [
          "顶部的 NEXT 会推进到当天的下一个事件，或第二天 08:00。",
          "现金、日期和存档操作都固定在顶栏，方便随时检查。",
        ],
      },
      {
        view: "Inbox",
        title: "Inbox 先处理必处理事项",
        body: "每天先看 Inbox。关键通知、live 开演和运营报告都会在这里出现。",
        bullets: [
          "带确认要求的消息会阻止推进时间，直到你处理。",
          "开局的成员概览、近期演出和 staff briefing 也会放在这里。",
        ],
      },
      {
        view: "Training",
        title: "Training 调整日常训练",
        body: "Training 用来给成员分配唱、跳、体能和目标训练，并挑选重点练习曲。",
        bullets: [
          "Roster 页能按能力、状态、年龄和士气排序。",
          "Assignments 页适合每周检查负荷，避免成员状态掉得太快。",
        ],
      },
      {
        view: "Schedule",
        title: "Schedule 看周历和月历",
        body: "Schedule 会把你自己的 live、已结算结果和官方媒体排程放在同一张时间线上。",
        bullets: [
          "双击日期可以把周视图锚定到那一天。",
          "月历上的标记会区分 booked live、已完成 live 和媒体活动。",
        ],
      },
      {
        view: "Lives",
        title: "Lives 负责排演出与开演",
        body: "在这里建立新 live、安排歌单、选择物販，并从已排日程进入正式开演。",
        bullets: [
          "Concert、Taiban、Routine、Festival 会带出不同默认设置。",
          "tokutenkai、VIP 和 goods 会直接影响收入与成员负担。",
        ],
      },
      {
        view: "Songs",
        title: "Songs 与 Making 管内容资产",
        body: "Songs 用来看曲库和发行盘；Making 负责单曲、专辑和物販制作。",
        bullets: [
          "曲目的熟练度与训练安排、live 演出会联动。",
          "先在 Making 做出 goods，再回到 Lives 才能带去会场销售。",
        ],
      },
      {
        view: "Scout",
        title: "Scout 扩充阵容",
        body: "Scout 里可以跟进 freelances、transfer target 和 audition 候选人，补强 roster。",
        bullets: [
          "Shortlist 会出现在左侧边栏，方便随时回看目标成员。",
          "签约条件会受人气、士气和你给出的合同影响。",
        ],
      },
      {
        view: "Finances",
        title: "Finances 看现金流",
        body: "Finances 会把票房、物販、tokutenkai、工资和固定成本集中起来，方便判断是否能继续扩张。",
        bullets: [
          "演出规模、票价和 goods 选择都会反映到每日收支。",
          "正式推进几天后记得检查现金消耗速度，再决定训练和招募节奏。",
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
