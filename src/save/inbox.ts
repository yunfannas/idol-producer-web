/**
 * Inbox notification rows compatible with idol_producer/ui/main_ui.py `_add_notification`.
 */

export interface NotificationRow {
  uid: string;
  date: string;
  created_at: string;
  title: string;
  body: string;
  sender: string;
  category: string;
  level: string;
  read: boolean;
  dedupe_key: string;
  requires_confirmation: boolean;
  choice_kind: string;
  choice_status: string;
  choice_options: Record<string, string>[];
  related_event_uid: string;
}

export function notificationSortKey(item: NotificationRow): [number, number, string] {
  const created = String(item.created_at || "").split("T");
  const dayText = String(item.date || created[0] || "").split("T")[0];
  let dayOrd = 0;
  try {
    dayOrd = new Date(dayText + "T12:00:00Z").getTime() / 86400000;
  } catch {
    dayOrd = 0;
  }
  const timeText = created[1] || "00:00:00";
  const timeParts = timeText.split(":").slice(0, 3);
  while (timeParts.length < 3) timeParts.push("0");
  let seconds = 0;
  try {
    seconds =
      Number(timeParts[0]) * 3600 + Number(timeParts[1]) * 60 + Number.parseFloat(timeParts[2] || "0");
  } catch {
    seconds = 0;
  }
  return [-dayOrd, -seconds, item.uid];
}

export function sortNotificationsInPlace(rows: NotificationRow[]): void {
  rows.sort((a, b) => {
    const ka = notificationSortKey(a);
    const kb = notificationSortKey(b);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2].localeCompare(kb[2]);
  });
}

function newUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `n-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function addNotification(
  save: { inbox: { notifications: NotificationRow[] } },
  params: {
    title: string;
    body: string;
    sender?: string;
    category?: string;
    level?: string;
    isoDate?: string;
    unread?: boolean;
    dedupeKey?: string;
  },
): NotificationRow {
  const {
    title,
    body,
    sender = "Assistant",
    category = "general",
    level = "normal",
    isoDate,
    unread = false,
    dedupeKey = "",
  } = params;

  const day = isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : new Date().toISOString().slice(0, 10);

  if (dedupeKey) {
    const existing = save.inbox.notifications.find((x) => x.dedupe_key === dedupeKey);
    if (existing) return existing;
  }

  const item: NotificationRow = {
    uid: newUid(),
    date: day,
    created_at: `${day}T09:00:00`,
    title,
    body,
    sender,
    category,
    level,
    read: !unread,
    dedupe_key: dedupeKey,
    requires_confirmation: false,
    choice_kind: "",
    choice_status: "",
    choice_options: [],
    related_event_uid: "",
  };
  save.inbox.notifications.push(item);
  sortNotificationsInPlace(save.inbox.notifications);
  return item;
}
