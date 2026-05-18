function normalizeColorCode(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "—" || raw === "â€”") return null;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) return raw;
  const hexMatch = /^0x([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.exec(raw);
  if (hexMatch) return `#${hexMatch[1]}`;
  return null;
}

export function resolveMemberColorCss(color: string, colorCode?: unknown): string | null {
  const codeCss = normalizeColorCode(colorCode);
  if (codeCss) return codeCss;

  const raw = String(color ?? "").trim();
  if (!raw || raw === "—" || raw === "â€”") return null;

  const literalCss = normalizeColorCode(raw);
  if (literalCss) return literalCss;

  const normalized = raw.toLowerCase().replace(/[\s_-]+/g, "");
  const namedColors: Record<string, string> = {
    white: "#f5f7fa",
    purewhite: "#ffffff",
    black: "#111111",
    gray: "#808080",
    grey: "#808080",
    red: "#e5484d",
    bloodyred: "#ff0000",
    blue: "#3b82f6",
    royalblue: "#4169e1",
    navyblue: "#000080",
    yellow: "#facc15",
    orange: "#fb923c",
    pink: "#ec4899",
    lightpink: "#ffb6c1",
    purple: "#a855f7",
    lightpurple: "#cbc3e3",
    green: "#22c55e",
    lightgreen: "#90ee90",
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
