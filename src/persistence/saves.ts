import type { GameSavePayload } from "../save/gameSaveSchema";
import { hydrateStoredGame } from "../save/migrate";

const STORAGE_VERSION = 2;
const KEY_PREFIX = "ip-web-save-v";
const LEGACY_STORAGE_VERSION = 1;
export const AUTOSAVE_SLOT = 10;

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

function legacyKey(accountName: string, slot: number): string {
  return `${KEY_PREFIX}${LEGACY_STORAGE_VERSION}-account-${accountToken(accountName)}-slot-${slot}`;
}

function globalLegacyKey(slot: number): string {
  return `${KEY_PREFIX}${LEGACY_STORAGE_VERSION}-slot-${slot}`;
}

function globalCurrentKey(slot: number): string {
  return `${KEY_PREFIX}${STORAGE_VERSION}-slot-${slot}`;
}

export function saveToSlot(accountName: string, slot: number, save: GameSavePayload): void {
  try {
    localStorage.setItem(key(accountName, slot), JSON.stringify(save));
    localStorage.removeItem(legacyKey(accountName, slot));
  } catch (e) {
    console.error("saveToSlot failed", e);
    throw e;
  }
}

export function loadFromSlot(accountName: string, slot: number): GameSavePayload | null {
  try {
    const normalized = normalizeAccountName(accountName);
    const raw =
      localStorage.getItem(key(normalized, slot)) ??
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
    localStorage.getItem(key(normalized, slot)) ||
      localStorage.getItem(legacyKey(normalized, slot)) ||
      (normalized.toLowerCase() === "default" &&
        (localStorage.getItem(globalCurrentKey(slot)) || localStorage.getItem(globalLegacyKey(slot)))),
  );
}

export function clearSlot(accountName: string, slot: number): void {
  localStorage.removeItem(key(accountName, slot));
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
