import { htmlEsc } from "./htmlEsc";

export type AppConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Accent the confirm button as destructive. */
  danger?: boolean;
};

/** In-app Confirm / Cancel modal. Resolves true only when Confirm is clicked. */
export function showAppConfirm(opts: AppConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "app-confirm-overlay";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "app-confirm-title");
    root.innerHTML = `
      <div class="app-confirm-backdrop" data-app-confirm="cancel"></div>
      <section class="app-confirm-panel">
        <h2 class="app-confirm-title" id="app-confirm-title">${htmlEsc(opts.title)}</h2>
        <p class="app-confirm-message">${htmlEsc(opts.message)}</p>
        <div class="app-confirm-actions">
          <button type="button" class="fm-btn" data-app-confirm="cancel">${htmlEsc(opts.cancelLabel)}</button>
          <button type="button" class="fm-btn ${opts.danger ? "fm-btn-danger" : "fm-btn-accent"}" data-app-confirm="ok" autofocus>${htmlEsc(opts.confirmLabel)}</button>
        </div>
      </section>
    `;

    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("keydown", onKey);
      root.remove();
      resolve(ok);
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        finish(false);
      }
    };

    root.querySelectorAll<HTMLElement>("[data-app-confirm]").forEach((el) => {
      el.addEventListener("click", () => finish(el.getAttribute("data-app-confirm") === "ok"));
    });
    window.addEventListener("keydown", onKey);
    document.body.appendChild(root);
    root.querySelector<HTMLButtonElement>('[data-app-confirm="ok"]')?.focus();
  });
}
