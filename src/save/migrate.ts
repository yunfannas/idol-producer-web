/**
 * Migrate earlier web-only persisted sessions to desktop-shaped GameSavePayload v11.
 */

import type { WebPreviewBundle } from "../types";
import type { Finances } from "../engine/types";
import type { NotificationRow } from "./inbox";
import { createGameSaveFromPreviewBundle, normalizeGameSavePayload, type GameSavePayload } from "./gameSaveSchema";

const LEGACY_WEB_STATE_VERSION = 1 as const;

interface LegacyEngineGameState extends Record<string, unknown> {
  schemaVersion: typeof LEGACY_WEB_STATE_VERSION;
  bundle: WebPreviewBundle;
  openingDate: string;
  daysElapsed: number;
  finances: Finances;
  popularity: number;
  fans: number;
  xFollowers: number;
  groupLetterTier: string;
  activityLog: string[];
}

function isLegacyWebState(raw: Record<string, unknown>): raw is LegacyEngineGameState {
  return raw.schemaVersion === LEGACY_WEB_STATE_VERSION && typeof raw.bundle === "object";
}

function activityToNotifications(lines: string[], isoDateHint: string): NotificationRow[] {
  const notifications: NotificationRow[] = [];
  const day =
    isoDateHint && /^\d{4}-\d{2}-\d{2}$/.test(isoDateHint) ? isoDateHint : new Date().toISOString().slice(0, 10);
  for (let i = 0; i < lines.length; i++) {
    const body = lines[i];
    notifications.push({
      uid: `migrated-${day}-${i}`,
      date: day,
      created_at: `${day}T09:${String(i % 59).padStart(2, "0")}:00`,
      title: i === 0 ? "Imported session" : "Log",
      body,
      sender: "System",
      category: "general",
      level: "normal",
      read: true,
      dedupe_key: "",
      requires_confirmation: false,
      choice_kind: "",
      choice_status: "",
      choice_options: [],
      related_event_uid: "",
    });
  }
  return notifications;
}

/** Return v11 payload, migrating from legacy wrapper if needed; null if not recoverable. */
export function hydrateStoredGame(raw: unknown): GameSavePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (obj.database_snapshot && typeof obj.database_snapshot === "object") {
    return normalizeGameSavePayload(raw);
  }

  if (!isLegacyWebState(obj)) return null;

  const save = createGameSaveFromPreviewBundle(obj.bundle);
  const g = save.database_snapshot.groups[0];
  if (g) {
    g.popularity = obj.popularity;
    g.fans = obj.fans;
    g.letter_tier = obj.groupLetterTier;
  }
  save.finances = obj.finances as unknown as GameSavePayload["finances"];
  save.game_start_date = obj.openingDate;
  save.turn_number = obj.daysElapsed;
  const lastProcessed = obj.finances.last_processed_date;
  save.current_date =
    typeof lastProcessed === "string" && lastProcessed
      ? lastProcessed.split("T")[0]
      : obj.openingDate;
  const hint = typeof save.current_date === "string" ? save.current_date : obj.openingDate;
  save.inbox.notifications = activityToNotifications(obj.activityLog ?? [], hint).concat(save.inbox.notifications);
  save.scenario_context.startup_date = obj.openingDate;

  return normalizeGameSavePayload(save);
}
