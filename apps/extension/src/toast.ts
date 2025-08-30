
export type ToastAction = {
  label: string;
  danger?: boolean;
  onClick?: () => void;
};

type ToastOpts = {
  durationMs?: number; 
};

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let currentToast: HTMLElement | null = null;

function ensureShadowHost() {
  if (host && shadow) return;
  host = document.getElementById("fg-toast-host") as HTMLElement | null;
  if (!host) {
    host = document.createElement("div");
    host.id = "fg-toast-host";

    Object.assign(host.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2147483647", 
    } as CSSStyleDeclaration);
    document.documentElement.appendChild(host);
  }
  if (!host.shadowRoot) {
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      /* Container that holds the toast (top-right) */
      .fg-wrap {
        position: fixed;
        top: 16px;
        right: 16px;
        left: auto;
        bottom: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none; /* children enable */
        z-index: 1;
      }
      .fg-toast {
        pointer-events: auto;
        min-width: 260px;
        max-width: min(480px, 92vw);
        background: rgba(28,28,31,0.96);
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        overflow: hidden;
        font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        border: 1px solid rgba(255,255,255,0.08);
        transform: translateY(-6px);
        opacity: 0;
        animation: fg-enter 160ms ease-out forwards;
      }
      @keyframes fg-enter { to { transform: translateY(0); opacity: 1; } }
      .fg-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: start;
        gap: 8px;
        padding: 12px 12px 8px 12px;
      }
      .fg-msg {
        white-space: pre-wrap;
        word-break: break-word;
      }
      .fg-x {
        background: transparent;
        border: 0;
        color: #cfcfd2;
        font: inherit;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 6px;
      }
      .fg-x:hover { color: #fff; background: rgba(255,255,255,0.08); }
      .fg-actions {
        display: flex;
        gap: 8px;
        padding: 0 12px 12px 12px;
        flex-wrap: wrap;
      }
      .fg-btn {
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        background: #2b2b30;
        color: #fff;
      }
      .fg-btn:hover { background: #3a3a41; }
      .fg-btn.fg-danger { background: #c6362b; }
      .fg-btn.fg-danger:hover { background: #b02e25; }
      @media (max-width: 560px) {
        .fg-wrap { right: 8px; top: 8px; }
        .fg-toast { min-width: 220px; }
      }
    `;
    const wrap = document.createElement("div");
    wrap.className = "fg-wrap";
    shadow!.append(style, wrap);
  } else {
    shadow = host.shadowRoot!;
  }
}

function disposeCurrent() {
  if (currentToast) {
    try { currentToast.remove(); } catch {}
    currentToast = null;
  }
}

export function showToast(message: string, actions: ToastAction[], opts?: ToastOpts) {
  try {
    ensureShadowHost();
    const wrap = shadow!.querySelector(".fg-wrap") as HTMLElement;
    if (!wrap) return;

    disposeCurrent();

    const root = document.createElement("div");
    root.className = "fg-toast";

    const row = document.createElement("div");
    row.className = "fg-row";

    const msg = document.createElement("div");
    msg.className = "fg-msg";
    msg.textContent = message;

    const x = document.createElement("button");
    x.className = "fg-x";
    x.setAttribute("aria-label", "Close");
    x.textContent = "×";
    x.addEventListener("click", () => disposeCurrent());

    row.append(msg, x);

    const actBar = document.createElement("div");
    actBar.className = "fg-actions";

    const onClickWrapper = (fn?: () => void) => () => {
      try { fn && fn(); } catch {}
      disposeCurrent();
    };

    (actions || []).slice(0, 3).forEach((a) => {
      const b = document.createElement("button");
      b.className = "fg-btn" + (a.danger ? " fg-danger" : "");
      b.textContent = a.label || "OK";
      b.addEventListener("click", onClickWrapper(a.onClick));
      actBar.appendChild(b);
    });

    root.append(row, actBar);
    wrap.appendChild(root);
    currentToast = root;

    const dur = opts?.durationMs;
    if (typeof dur === "number" && isFinite(dur) && dur > 0) {
      setTimeout(() => disposeCurrent(), dur);
    }

    console.log("[FG] toast shown:", { message, actions: actions?.map(a => a.label) });
  } catch (e) {

    alert(message);
  }
}
