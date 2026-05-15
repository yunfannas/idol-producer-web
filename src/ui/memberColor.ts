export function resolveMemberColorCss(color: string): string | null {
  const raw = String(color ?? "").trim();
  if (!raw || raw === "—") return null;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) return raw;

  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, "");
  const namedColors: Record<string, string> = {
    white: "#f5f7fa",
    black: "#111111",
    red: "#e5484d",
    blue: "#3b82f6",
    yellow: "#facc15",
    orange: "#fb923c",
    pink: "#ec4899",
    purple: "#a855f7",
    green: "#22c55e",
    mintgreen: "#34d399",
    lightblue: "#7dd3fc",
    skyblue: "#38bdf8",
    aqua: "#22d3ee",
    turquoise: "#2dd4bf",
    teal: "#14b8a6",
    lime: "#84cc16",
    gold: "#f59e0b",
    silver: "#cbd5e1",
  };

  return namedColors[normalized] ?? null;
}
