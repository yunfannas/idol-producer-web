export interface ZhWikiTermOverride {
  key: string;
  label: string;
  aliases: string[];
}

/**
 * Fill this file with the Chinese terms you want the in-game wiki to display and match.
 * `label` is what appears in the wiki panel.
 * `aliases` are the clickable terms the matcher should recognize in the UI text.
 *
 * English aliases still present for replacement:
 * - inbox: Inbox
 * - training: Training, Assignments
 * - schedule: Schedule, calendar
 * - live: Live Start, live, lives
 * - tokutenkai: cheki, tokutenkai
 * - goods: goods, goods booth, merch
 * - setlist: setlist, running order, program
 * - shortlist: shortlist, shortlisted
 * - scout: Scout
 * - fans: fans, fan count, attendance
 * - condition: condition
 * - morale: morale
 * - taiban: Taiban, taiban
 * - concert: Concert, concert, one-man
 * - festival: Festival, festival
 * - finances: Finances, cash on hand, ticket price
 *
 * Example:
 * { key: "setlist", label: "节目单", aliases: ["节目单", "歌单", "setlist"] }
 */
export const ZH_WIKI_TERM_OVERRIDES: ZhWikiTermOverride[] = [
  { key: "inbox", label: "收件箱", aliases: ["收件箱", "Inbox"] },
  { key: "training", label: "训练", aliases: ["训练", "训练安排", "Training", "Assignments"] },
  { key: "schedule", label: "日程", aliases: ["日程", "日历", "Schedule", "calendar"] },
  { key: "live", label: "演出", aliases: ["演出", "开始演出", "Live Start", "live", "lives"] },
  { key: "tokutenkai", label: "特典会", aliases: ["特典会", "チェキ", "cheki", "tokutenkai"] },
  { key: "goods", label: "周边", aliases: ["周边", "物販", "goods", "goods booth", "merch"] },
  { key: "setlist", label: "节目单", aliases: ["节目单", "歌单", "setlist", "running order", "program"] },
  { key: "shortlist", label: "候选名单", aliases: ["候选名单", "候选", "shortlist", "shortlisted"] },
  { key: "scout", label: "星探", aliases: ["星探", "试镜", "自由人", "转会目标", "Scout"] },
  { key: "fans", label: "粉丝", aliases: ["粉丝", "粉丝数", "到场", "fans", "fan count", "attendance"] },
  { key: "condition", label: "状态", aliases: ["状态", "condition"] },
  { key: "morale", label: "士气", aliases: ["士气", "morale"] },
  { key: "taiban", label: "拼盘", aliases: ["拼盘", "对盘", "Taiban", "taiban"] },
  { key: "concert", label: "公演", aliases: ["公演", "单独公演", "Concert", "concert", "one-man"] },
  { key: "festival", label: "音乐节", aliases: ["音乐节", "Festival", "festival"] },
  { key: "league", label: "联赛", aliases: ["联赛", "League", "league", "HEROINES League", "入れ替え戦", "昇格戦"] },
  { key: "finances", label: "财务", aliases: ["财务", "现金", "票价", "Finances", "cash on hand", "ticket price"] },
];
