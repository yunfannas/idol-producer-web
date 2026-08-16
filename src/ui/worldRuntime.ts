type WorldRuntimeState = {
  raf: number | null;
  startedAt: number;
  lastActivityTick: number;
  activityIndex: number;
};

const runtimeByRoot = new WeakMap<HTMLElement, WorldRuntimeState>();

const ACTIVITY_LABELS = [
  "sorting overnight notes",
  "checking member arrivals",
  "reviewing rehearsal clips",
  "answering staff pings",
  "watching the practice room",
];

function stopRuntime(root: HTMLElement): void {
  const existing = runtimeByRoot.get(root);
  if (!existing) return;
  if (existing.raf != null) cancelAnimationFrame(existing.raf);
  runtimeByRoot.delete(root);
}

function tick(root: HTMLElement, state: WorldRuntimeState, now: number): void {
  const elapsed = (now - state.startedAt) / 1000;
  root.style.setProperty("--world-pulse", String((Math.sin(elapsed * 1.8) + 1) / 2));

  root.querySelectorAll<HTMLElement>("[data-world-actor]").forEach((actor, index) => {
    const phase = elapsed * (0.75 + index * 0.05) + index * 1.7;
    actor.style.setProperty("--actor-dx", `${Math.sin(phase) * 5}px`);
    actor.style.setProperty("--actor-dy", `${Math.cos(phase * 0.8) * 4}px`);
  });

  if (now - state.lastActivityTick > 4200) {
    state.lastActivityTick = now;
    state.activityIndex = (state.activityIndex + 1) % ACTIVITY_LABELS.length;
    const label = root.querySelector<HTMLElement>("[data-world-activity-label]");
    if (label) label.textContent = ACTIVITY_LABELS[state.activityIndex];
  }

  state.raf = requestAnimationFrame((nextNow) => tick(root, state, nextNow));
}

export function mountWorldRuntime(root: ParentNode): void {
  if (typeof requestAnimationFrame === "undefined") return;
  const worldRoot = root.querySelector<HTMLElement>("[data-world-runtime]");
  if (!worldRoot) return;
  stopRuntime(worldRoot);
  const state: WorldRuntimeState = {
    raf: null,
    startedAt: performance.now(),
    lastActivityTick: 0,
    activityIndex: 0,
  };
  runtimeByRoot.set(worldRoot, state);
  state.raf = requestAnimationFrame((now) => tick(worldRoot, state, now));
}
