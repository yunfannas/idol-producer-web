import type { GameSavePayload } from "../save/gameSaveSchema";
import { hydrateStoredGame } from "../save/migrate";

const STORAGE_VERSION = 2;
const KEY_PREFIX = "ip-web-save-v";
const LEGACY_STORAGE_VERSION = 1;
export const AUTOSAVE_SLOT = 10;

function key(slot: number): string {
  if (slot < 0 || slot > AUTOSAVE_SLOT || !Number.isInteger(slot)) {
    throw new Error(`Save slot must be an integer 0-${AUTOSAVE_SLOT}`);
  }
  return `${KEY_PREFIX}${STORAGE_VERSION}-slot-${slot}`;
}

function legacyKey(slot: number): string {
  return `${KEY_PREFIX}${LEGACY_STORAGE_VERSION}-slot-${slot}`;
}

export function saveToSlot(slot: number, save: GameSavePayload): void {
  try {
    localStorage.setItem(key(slot), JSON.stringify(save));
    localStorage.removeItem(legacyKey(slot));
  } catch (e) {
    console.error("saveToSlot failed", e);
    throw e;
  }
}

export function loadFromSlot(slot: number): GameSavePayload | null {
  try {
    const raw = localStorage.getItem(key(slot)) ?? localStorage.getItem(legacyKey(slot));
    if (!raw) return null;
    return hydrateStoredGame(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function rawHas(slot: number): boolean {
  return Boolean(localStorage.getItem(key(slot)) || localStorage.getItem(legacyKey(slot)));
}

export function clearSlot(slot: number): void {
  localStorage.removeItem(key(slot));
  localStorage.removeItem(legacyKey(slot));
}

export function listOccupiedSlots(): number[] {
  const out: number[] = [];
  for (let s = 0; s <= AUTOSAVE_SLOT; s++) {
    if (rawHas(s)) out.push(s);
  }
  return out;
}
