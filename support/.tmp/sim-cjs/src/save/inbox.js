"use strict";
/**
 * Inbox notification rows compatible with idol_producer/ui/main_ui.py `_add_notification`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationSortKey = notificationSortKey;
exports.sortNotificationsInPlace = sortNotificationsInPlace;
exports.notificationRequiresAck = notificationRequiresAck;
exports.getBlockingNotification = getBlockingNotification;
exports.addNotification = addNotification;
function notificationSortKey(item) {
    const created = String(item.created_at || "").split("T");
    const dayText = String(item.date || created[0] || "").split("T")[0];
    let dayOrd = 0;
    try {
        dayOrd = new Date(dayText + "T12:00:00Z").getTime() / 86400000;
    }
    catch {
        dayOrd = 0;
    }
    const timeText = created[1] || "00:00:00";
    const timeParts = timeText.split(":").slice(0, 3);
    while (timeParts.length < 3)
        timeParts.push("0");
    let seconds = 0;
    try {
        seconds =
            Number(timeParts[0]) * 3600 + Number(timeParts[1]) * 60 + Number.parseFloat(timeParts[2] || "0");
    }
    catch {
        seconds = 0;
    }
    return [-dayOrd, -seconds, item.uid];
}
function notificationCreatedAtMs(item) {
    const createdAt = String(item.created_at || "").trim();
    if (createdAt) {
        const direct = Date.parse(`${createdAt.endsWith("Z") ? createdAt : `${createdAt}Z`}`);
        if (Number.isFinite(direct))
            return direct;
    }
    const dayText = String(item.date || "").split("T")[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dayText)) {
        const fallback = Date.parse(`${dayText}T00:00:00Z`);
        if (Number.isFinite(fallback))
            return fallback;
    }
    return 0;
}
function sortNotificationsInPlace(rows) {
    rows.sort((a, b) => {
        const ka = notificationSortKey(a);
        const kb = notificationSortKey(b);
        if (ka[0] !== kb[0])
            return ka[0] - kb[0];
        if (ka[1] !== kb[1])
            return ka[1] - kb[1];
        return ka[2].localeCompare(kb[2]);
    });
}
/** Mirrors `main_ui.py` `_notification_requires_confirmation` (subset used on web). */
function notificationRequiresAck(item) {
    if (!item)
        return false;
    if (item.requires_confirmation)
        return true;
    if (String(item.choice_status ?? "").trim() === "pending")
        return true;
    const cat = String(item.category ?? "").toLowerCase();
    const title = String(item.title ?? "").toLowerCase();
    if (cat === "confirmation" || cat === "decision")
        return true;
    const needles = ["scandal revealed", "today's live schedule", "signing confirmation"];
    return needles.some((n) => title.includes(n));
}
/**
 * Newest-first blocking item at or before `currentIso` (matches desktop `_get_blocking_notification_for_current_day` sort + `[0]`).
 */
function getBlockingNotification(notifications, currentIso) {
    const currentText = String(currentIso ?? "").trim();
    const currentMs = Date.parse(`${currentText.includes("T") ? currentText : `${currentText}T23:59:59`}${currentText.endsWith("Z") ? "" : "Z"}`);
    const blocking = [];
    for (const item of notifications) {
        if (!notificationRequiresAck(item))
            continue;
        if (item.read && String(item.choice_status ?? "").trim() !== "pending")
            continue;
        const itemMs = notificationCreatedAtMs(item);
        if (Number.isFinite(currentMs) && itemMs > currentMs)
            continue;
        blocking.push(item);
    }
    if (!blocking.length)
        return null;
    blocking.sort((a, b) => {
        const ka = notificationSortKey(a);
        const kb = notificationSortKey(b);
        if (ka[0] !== kb[0])
            return ka[0] - kb[0];
        if (ka[1] !== kb[1])
            return ka[1] - kb[1];
        return ka[2].localeCompare(kb[2]);
    });
    return blocking[0] ?? null;
}
function newUid() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `n-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function addNotification(save, params) {
    const { title, body, sender = "Assistant", category = "general", level = "normal", isoDate, createdTime, unread = false, dedupeKey = "", requiresConfirmation = false, relatedEventUid = "", reportData, } = params;
    const day = isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : new Date().toISOString().slice(0, 10);
    const time = createdTime && /^\d{2}:\d{2}:\d{2}$/.test(createdTime.trim()) ? createdTime.trim() : "09:00:00";
    if (dedupeKey) {
        const existing = save.inbox.notifications.find((x) => x.dedupe_key === dedupeKey);
        if (existing)
            return existing;
    }
    const item = {
        uid: newUid(),
        date: day,
        created_at: `${day}T${time}`,
        title,
        body,
        sender,
        category,
        level,
        read: !unread,
        dedupe_key: dedupeKey,
        requires_confirmation: Boolean(requiresConfirmation),
        choice_kind: "",
        choice_status: "",
        choice_options: [],
        related_event_uid: relatedEventUid ? String(relatedEventUid) : "",
        report_data: reportData,
    };
    save.inbox.notifications.push(item);
    sortNotificationsInPlace(save.inbox.notifications);
    return item;
}
