"use strict";
/**
 * Live schedule + venue selection ported from `idol_producer/ui/main_ui.py`
 * (`_pick_startup_live_venue`, `_build_fallback_startup_live`, `_get_live_type_presets`).
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVE_TYPE_PRESETS = void 0;
exports.loadVenuesCatalog = loadVenuesCatalog;
exports.getVenuesCatalog = getVenuesCatalog;
exports.pickVenueForDesiredCapacity = pickVenueForDesiredCapacity;
exports.addMinutesToHHMM = addMinutesToHHMM;
exports.durationMinutesBetweenHHMM = durationMinutesBetweenHHMM;
exports.autoSetlistSongCountForLive = autoSetlistSongCountForLive;
exports.buildAutoProgramForLive = buildAutoProgramForLive;
exports.desiredStartupLiveCapacityFromFans = desiredStartupLiveCapacityFromFans;
exports.buildAutopilotRoutineLive = buildAutopilotRoutineLive;
exports.formatLiveSlotLine = formatLiveSlotLine;
const venues_json_1 = __importDefault(require("./data/venues.json"));
/** Same keys as desktop `_get_live_type_presets` (subset used for web autopilot Routine). */
exports.LIVE_TYPE_PRESETS = {
    Concert: {
        event_type: "Concert",
        default_start_time: "18:00",
        default_duration: 120,
        rehearsal_start: "12:00",
        rehearsal_end: "16:00",
        tokutenkai_enabled: false,
        tokutenkai_duration: 90,
        tokutenkai_ticket_price: 2000,
        tokutenkai_slot_seconds: 40,
        tokutenkai_expected_tickets: 0,
    },
    Birthday: {
        event_type: "Birthday",
        default_start_time: "18:00",
        default_duration: 120,
        rehearsal_start: "12:00",
        rehearsal_end: "16:00",
        tokutenkai_enabled: true,
        tokutenkai_duration: 90,
        tokutenkai_ticket_price: 2000,
        tokutenkai_slot_seconds: 40,
        tokutenkai_expected_tickets: 60,
    },
    Routine: {
        event_type: "Routine",
        default_start_time: "18:00",
        default_duration: 70,
        rehearsal_start: "",
        rehearsal_end: "",
        tokutenkai_enabled: true,
        tokutenkai_duration: 90,
        tokutenkai_ticket_price: 2000,
        tokutenkai_slot_seconds: 20,
        tokutenkai_expected_tickets: 90,
    },
    Taiban: {
        event_type: "Taiban",
        default_start_time: "17:00",
        default_duration: 30,
        rehearsal_start: "",
        rehearsal_end: "",
        tokutenkai_enabled: true,
        tokutenkai_duration: 60,
        tokutenkai_ticket_price: 2000,
        tokutenkai_slot_seconds: 20,
        tokutenkai_expected_tickets: 48,
    },
    Festival: {
        event_type: "Festival",
        default_start_time: "12:00",
        default_duration: 30,
        rehearsal_start: "",
        rehearsal_end: "",
        tokutenkai_enabled: false,
        tokutenkai_duration: 0,
        tokutenkai_ticket_price: 0,
        tokutenkai_slot_seconds: 0,
        tokutenkai_expected_tickets: 0,
    },
    Tokutenkai: {
        event_type: "Tokutenkai",
        default_start_time: "14:00",
        default_duration: 90,
        rehearsal_start: "",
        rehearsal_end: "",
        tokutenkai_enabled: true,
        tokutenkai_duration: 90,
        tokutenkai_ticket_price: 2000,
        tokutenkai_slot_seconds: 30,
        tokutenkai_expected_tickets: 80,
    },
};
function loadVenuesCatalog() {
    const raw = venues_json_1.default.venues;
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const row of raw) {
        if (!row || typeof row !== "object")
            continue;
        const r = row;
        const name = String(r.name ?? "").trim();
        const cap = typeof r.capacity === "number" ? r.capacity : Number(r.capacity ?? 0) || 0;
        if (!name || cap <= 0)
            continue;
        const settingRaw = String(r.setting ?? "").toLowerCase();
        const setting = settingRaw === "outdoor" || settingRaw === "indoor"
            ? settingRaw
            : undefined;
        out.push({
            uid: String(r.uid ?? ""),
            name,
            name_romanji: typeof r.name_romanji === "string" ? r.name_romanji : undefined,
            venue_type: typeof r.venue_type === "string" ? r.venue_type : undefined,
            location: typeof r.location === "string" ? r.location : undefined,
            city: typeof r.city === "string" ? r.city : undefined,
            setting,
            capacity: cap,
        });
    }
    return out;
}
let venuesMemo = null;
function getVenuesCatalog() {
    if (!venuesMemo)
        venuesMemo = loadVenuesCatalog();
    return venuesMemo;
}
/** Closest capacity match — desktop `_pick_startup_live_venue`. */
function pickVenueForDesiredCapacity(venues, desiredCapacity) {
    const candidates = venues.filter((v) => v.name && v.capacity > 0);
    if (!candidates.length) {
        return { name: "TBA venue", uid: null, location: "", capacity: null };
    }
    const want = Math.max(0, Math.trunc(desiredCapacity));
    const sorted = [...candidates].sort((a, b) => Math.abs(a.capacity - want) - Math.abs(b.capacity - want));
    const venue = sorted[0];
    return {
        name: venue.name,
        uid: venue.uid || null,
        location: venue.location ?? "",
        capacity: venue.capacity,
    };
}
/** `HH:MM` + minutes, 24h wrap (desktop `_compute_live_end_time` style for same-day). */
function addMinutesToHHMM(startTime, durationMinutes) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(startTime ?? "").trim());
    if (!m)
        return "";
    const h0 = Number(m[1]);
    const min0 = Number(m[2]);
    if (!Number.isFinite(h0) || !Number.isFinite(min0))
        return "";
    let total = h0 * 60 + min0 + Math.max(0, Math.trunc(durationMinutes));
    total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(total / 60);
    const min = total % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
function hhmmToMinutes(value) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
    if (!m)
        return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min))
        return null;
    return h * 60 + min;
}
function durationMinutesBetweenHHMM(startTime, endTime) {
    const start = hhmmToMinutes(startTime);
    const end = hhmmToMinutes(endTime);
    if (start == null || end == null)
        return null;
    let delta = end - start;
    if (delta < 0)
        delta += 24 * 60;
    return delta;
}
function autoSetlistSongCountForLive(liveType, durationMinutes, fallbackCount = 0) {
    const duration = Math.max(0, Math.trunc(durationMinutes));
    if (duration <= 0)
        return Math.max(0, Math.trunc(fallbackCount));
    const typeKey = String(liveType ?? "").trim();
    if (typeKey === "Concert" || typeKey === "OneMan") {
        if (duration >= 95)
            return 18;
        if (duration >= 80)
            return 16;
    }
    if (typeKey === "Taiban" || typeKey === "Festival" || typeKey === "Joint" || typeKey === "Routine") {
        return Math.max(1, Math.floor(duration / 5));
    }
    return Math.max(1, Math.trunc(fallbackCount || Math.round(duration / 15)));
}
function buildSongProgramItems(setlist, prefix) {
    return setlist.map((title, index) => ({
        id: `${prefix}-song-${index + 1}`,
        kind: "song",
        label: title,
        songTitle: title,
        durationMinutes: 0,
    }));
}
function appendSongSegment(out, setlist, indexRef, count, prefix) {
    for (let i = 0; i < count && indexRef.value < setlist.length; i += 1) {
        const title = setlist[indexRef.value];
        out.push({
            id: `${prefix}-song-${indexRef.value + 1}`,
            kind: "song",
            label: title,
            songTitle: title,
            durationMinutes: 0,
        });
        indexRef.value += 1;
    }
}
function buildAutoProgramForLive(liveType, durationMinutes, setlist, idPrefix) {
    const duration = Math.max(0, Math.trunc(durationMinutes));
    const typeKey = String(liveType ?? "").trim();
    if ((typeKey === "Concert" || typeKey === "OneMan") && duration >= 95 && setlist.length >= 18) {
        const out = [];
        const indexRef = { value: 0 };
        appendSongSegment(out, setlist, indexRef, 6, idPrefix);
        out.push({ id: `${idPrefix}-mc-1`, kind: "mc", label: "MC", durationMinutes: 2 });
        appendSongSegment(out, setlist, indexRef, 6, idPrefix);
        out.push({ id: `${idPrefix}-break-1`, kind: "break", label: "Costume change", durationMinutes: 6 });
        out.push({ id: `${idPrefix}-mc-2`, kind: "mc", label: "MC", durationMinutes: 6 });
        appendSongSegment(out, setlist, indexRef, 6, idPrefix);
        return out;
    }
    if ((typeKey === "Concert" || typeKey === "OneMan") && duration >= 80 && setlist.length >= 16) {
        const out = [];
        const indexRef = { value: 0 };
        appendSongSegment(out, setlist, indexRef, 5, idPrefix);
        out.push({ id: `${idPrefix}-mc-1`, kind: "mc", label: "MC", durationMinutes: 2 });
        appendSongSegment(out, setlist, indexRef, 5, idPrefix);
        out.push({ id: `${idPrefix}-mc-2`, kind: "mc", label: "MC", durationMinutes: 6 });
        appendSongSegment(out, setlist, indexRef, Math.max(0, setlist.length - indexRef.value), idPrefix);
        return out;
    }
    return buildSongProgramItems(setlist, idPrefix);
}
function desiredStartupLiveCapacityFromFans(fans) {
    const f = Math.max(0, Math.trunc(fans));
    return Math.max(120, Math.min(2400, Math.trunc(Math.max(f, 800) * 0.2)));
}
/**
 * One autopilot Routine live row aligned with desktop `_build_fallback_startup_live`
 * (venue from `database/venues.json`, times + tokutenkai from Routine preset).
 */
function buildAutopilotRoutineLive(params) {
    const { targetIso, group, setlist } = params;
    const liveType = "Routine";
    const preset = exports.LIVE_TYPE_PRESETS[liveType] ?? exports.LIVE_TYPE_PRESETS.Routine;
    const groupName = String(group.name ?? "").trim() || String(group.name_romanji ?? "").trim() || "Managed Group";
    const groupRomanji = String(group.name_romanji ?? "").trim();
    const groupNames = [String(group.name ?? "").trim(), groupRomanji].filter(Boolean);
    const gFans = typeof group.fans === "number" ? group.fans : Number(group.fans ?? 0) || 0;
    const desiredCapacity = desiredStartupLiveCapacityFromFans(gFans);
    const venuePick = pickVenueForDesiredCapacity(getVenuesCatalog(), desiredCapacity);
    const capacity = venuePick.capacity ?? 200;
    const startTime = preset.default_start_time;
    const duration = preset.default_duration;
    const endTime = addMinutesToHHMM(startTime, duration);
    const tokutenkaiStart = preset.tokutenkai_enabled && endTime ? endTime : "";
    const tokutenkaiEnd = preset.tokutenkai_enabled && tokutenkaiStart
        ? addMinutesToHHMM(tokutenkaiStart, preset.tokutenkai_duration)
        : "";
    const presetTokuten = Math.max(0, Math.trunc(preset.tokutenkai_expected_tickets));
    const fromFans = Math.round(50 + gFans * 0.04);
    const capRoom = Math.max(1, capacity - 20);
    const baseline = presetTokuten > 0 ? presetTokuten : 30;
    const tokutenkaiExpected = Math.min(capRoom, Math.max(baseline, fromFans));
    const gUid = String(group.uid ?? "");
    const uid = `autopilot-live-${gUid}-${targetIso}`;
    return {
        uid,
        title: `${groupName} Regular Live`,
        title_romanji: "",
        event_type: preset.event_type,
        live_type: liveType,
        start_date: targetIso,
        end_date: targetIso,
        start_time: startTime,
        end_time: endTime,
        duration,
        rehearsal_start: preset.rehearsal_start,
        rehearsal_end: preset.rehearsal_end,
        venue: venuePick.name,
        venue_uid: venuePick.uid,
        location: venuePick.location,
        description: `Web autopilot ${liveType.toLowerCase()} for ${groupName}.`,
        performance_count: 1,
        capacity,
        attendance: null,
        ticket_price: null,
        poster_image_path: null,
        setlist,
        tokutenkai_enabled: preset.tokutenkai_enabled,
        tokutenkai_start: tokutenkaiStart,
        tokutenkai_end: tokutenkaiEnd,
        tokutenkai_duration: preset.tokutenkai_duration,
        tokutenkai_ticket_price: preset.tokutenkai_ticket_price,
        tokutenkai_slot_seconds: preset.tokutenkai_slot_seconds,
        tokutenkai_expected_tickets: tokutenkaiExpected,
        group: groupNames.length ? groupNames : [groupName],
        group_uid: String(group.uid ?? ""),
        status: "scheduled",
    };
}
function formatLiveSlotLine(live) {
    const date = String(live.start_date ?? "").split("T")[0];
    const st = String(live.start_time ?? "").trim();
    const et = String(live.end_time ?? "").trim();
    const time = st && et ? `${st}–${et}` : st ? `${st}` : "";
    return [date, time].filter(Boolean).join(" ");
}
