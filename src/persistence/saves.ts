import type { GameSavePayload } from "../save/gameSaveSchema";
import { hydrateStoredGame } from "../save/migrate";

const STORAGE_VERSION = 2;
const KEY_PREFIX = "ip-web-save-v";
const LEGACY_STORAGE_VERSION = 1;
const META_SUFFIX = "-meta";
const DB_NAME = "idol-producer-web-saves";
const STORE_NAME = "slotPayloads";
export const AUTOSAVE_SLOT = 10;

export interface SlotSummary {
  slot: number;
  label: string;
}

export function normalizeAccountName(accountName: string): string {
  return accountName.trim();
}

function accountToken(accountName: string): string {
  const normalized = normalizeAccountName(accountName);
  if (!normalized) {
    throw new Error("Account name is required.");
  }
  return encodeURIComponent(normalized.toLowerCase());
}

function key(accountName: string, slot: number): string {
  if (slot < 0 || slot > AUTOSAVE_SLOT || !Number.isInteger(slot)) {
    throw new Error(`Save slot must be an integer 0-${AUTOSAVE_SLOT}`);
  }
  return `${KEY_PREFIX}${STORAGE_VERSION}-account-${accountToken(accountName)}-slot-${slot}`;
}

function metaKey(accountName: string, slot: number): string {
  return `${key(accountName, slot)}${META_SUFFIX}`;
}

function buildSlotLabel(save: GameSavePayload): string {
  const groupName =
    String(save.managing_group ?? "").trim() ||
    String(
      save.database_snapshot.groups.find(
        (row) => String((row as { uid?: unknown }).uid ?? "").trim() === String(save.managing_group_uid ?? "").trim(),
      )?.name ?? "",
    ).trim() ||
    "save";
  const currentDate = String(save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? "").split("T")[0].trim();
  return currentDate ? `${groupName}_${currentDate}` : groupName;
}

function writeMeta(accountName: string, slot: number, save: GameSavePayload): void {
  const meta = {
    label: buildSlotLabel(save),
    saved_at: new Date().toISOString(),
  };
  localStorage.setItem(metaKey(accountName, slot), JSON.stringify(meta));
}

function readMetaLabel(accountName: string, slot: number): string | null {
  try {
    const raw = localStorage.getItem(metaKey(accountName, slot));
    if (!raw) return null;
    if (raw === "1") return "saved";
    const parsed = JSON.parse(raw) as { label?: unknown };
    const label = String(parsed?.label ?? "").trim();
    return label || "saved";
  } catch {
    return "saved";
  }
}

function legacyKey(accountName: string, slot: number): string {
  return `${KEY_PREFIX}${LEGACY_STORAGE_VERSION}-account-${accountToken(accountName)}-slot-${slot}`;
}

function globalLegacyKey(slot: number): string {
  return `${KEY_PREFIX}${LEGACY_STORAGE_VERSION}-slot-${slot}`;
}

function globalCurrentKey(slot: number): string {
  return `${KEY_PREFIX}${STORAGE_VERSION}-slot-${slot}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function idbGet(db: IDBDatabase, storageKey: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(storageKey);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB get failed"));
  });
}

function idbPut(db: IDBDatabase, storageKey: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, storageKey);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("IndexedDB put failed"));
  });
}

function idbDelete(db: IDBDatabase, storageKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(storageKey);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error("IndexedDB delete failed"));
  });
}

export async function saveToSlot(accountName: string, slot: number, save: GameSavePayload): Promise<void> {
  const storageKey = key(accountName, slot);
  try {
    const db = await openDb();
    await idbPut(db, storageKey, save);
    db.close();
    writeMeta(accountName, slot, save);
    localStorage.removeItem(legacyKey(accountName, slot));
    localStorage.removeItem(globalCurrentKey(slot));
    localStorage.removeItem(globalLegacyKey(slot));
  } catch (e) {
    console.error("saveToSlot failed", e);
    throw e;
  }
}

export async function loadFromSlot(accountName: string, slot: number): Promise<GameSavePayload | null> {
  try {
    const normalized = normalizeAccountName(accountName);
    const storageKey = key(normalized, slot);
    const db = await openDb();
    const stored = await idbGet(db, storageKey);
    db.close();
    if (stored) {
      return hydrateStoredGame(stored);
    }
    const raw =
      localStorage.getItem(storageKey) ??
      localStorage.getItem(legacyKey(normalized, slot)) ??
      (normalized.toLowerCase() === "default"
        ? localStorage.getItem(globalCurrentKey(slot)) ?? localStorage.getItem(globalLegacyKey(slot))
        : null);
    if (!raw) return null;
    return hydrateStoredGame(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function rawHas(accountName: string, slot: number): boolean {
  const normalized = normalizeAccountName(accountName);
  return Boolean(
    localStorage.getItem(metaKey(normalized, slot)) ||
      localStorage.getItem(key(normalized, slot)) ||
      localStorage.getItem(legacyKey(normalized, slot)) ||
      (normalized.toLowerCase() === "default" &&
        (localStorage.getItem(globalCurrentKey(slot)) || localStorage.getItem(globalLegacyKey(slot)))),
  );
}

export async function clearSlot(accountName: string, slot: number): Promise<void> {
  const storageKey = key(accountName, slot);
  try {
    const db = await openDb();
    await idbDelete(db, storageKey);
    db.close();
  } catch {
    /* ignore idb delete failures so local markers can still clear */
  }
  localStorage.removeItem(metaKey(accountName, slot));
  localStorage.removeItem(storageKey);
  localStorage.removeItem(legacyKey(accountName, slot));
}

export function listOccupiedSlots(accountName: string): number[] {
  if (!normalizeAccountName(accountName)) return [];
  const out: number[] = [];
  for (let s = 0; s <= AUTOSAVE_SLOT; s++) {
    if (rawHas(accountName, s)) out.push(s);
  }
  return out;
}

export function listSlotSummaries(accountName: string): SlotSummary[] {
  if (!normalizeAccountName(accountName)) return [];
  const out: SlotSummary[] = [];
  for (let s = 0; s <= AUTOSAVE_SLOT; s++) {
    if (!rawHas(accountName, s)) continue;
    out.push({
      slot: s,
      label: readMetaLabel(accountName, s) ?? "saved",
    });
  }
  return out;
}
