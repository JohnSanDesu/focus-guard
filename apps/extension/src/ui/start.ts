/// <reference types="chrome" />

type FocusProfile = { allow: string[]; block: string[] }; // neutral removed

const BASE_CATEGORIES = [
  "Mathematics","Computer Science","Data Science","Software Engineering","Research Methods",
  "Finance Study","Economics","Health Study","Physics","Chemistry",
  "Biology","Language Learning","Productivity","General News","Tech News",
  "Gaming","Variety Entertainment","Short-form Social","Sports","Music"
];

function fillSelect(el: HTMLSelectElement, items: string[]) {
  el.innerHTML = "";
  for (const v of items) {
    const opt = document.createElement("option");
    opt.value = v; opt.textContent = v;
    el.appendChild(opt);
  }
}

function getSelected(el: HTMLSelectElement): string[] {
  return Array.from(el.selectedOptions).map(o => o.value);
}

function uniq<T>(xs: T[]) { return Array.from(new Set(xs)); }

function normalizeProfile(allow: string[], block: string[]): FocusProfile {
  const b = uniq(block);
  const a = uniq(allow.filter(x => !b.includes(x))); // block wins
  return { allow: a, block: b };
}

type Existing = { minutes?: number; consent?: boolean; profile?: FocusProfile; goal?: string };

async function loadExisting(): Promise<Existing> {
  return new Promise(resolve => {
    chrome.storage.local.get(["fg_minutes", "fg_consent", "fg_profile", "fg_goal"], (d) => {
      const out: Existing = {};

      if (typeof d?.fg_minutes === "number") out.minutes = d.fg_minutes;
      if (typeof d?.fg_consent === "boolean") out.consent = d.fg_consent;

      const p = d?.fg_profile as any;
      if (p && Array.isArray(p.allow) && Array.isArray(p.block)) {
        out.profile = { allow: p.allow, block: p.block };
      }

      if (typeof d?.fg_goal === "string") out.goal = d.fg_goal;

      resolve(out);
    });
  });
}

async function getActiveEnd(): Promise<number | null> {
  return new Promise(res => {
    chrome.storage.local.get(["fg_session_endAt"], (d) => {
      const t = d?.fg_session_endAt;
      res(typeof t === "number" && t > Date.now() ? t : null);
    });
  });
}

function fmt(remMs: number) {
  const s = Math.max(0, Math.floor(remMs / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

async function main() {
  const elStatus = document.getElementById("fg-status")!;
  const elMinutes = document.querySelector<HTMLInputElement>("#fg-minutes")!;
  const elConsent = document.querySelector<HTMLInputElement>("#fg-consent")!;
  const elAllow   = document.querySelector<HTMLSelectElement>("#fg-allow")!;
  const elBlock   = document.querySelector<HTMLSelectElement>("#fg-block")!;
  const elNeutral = document.querySelector<HTMLSelectElement>("#fg-neutral")!;
  const elGoal    = document.querySelector<HTMLTextAreaElement>("#fg-goal")!;
  const elSave    = document.querySelector<HTMLButtonElement>("#fg-save")!;
  const elClear   = document.querySelector<HTMLButtonElement>("#fg-clear")!;
  const elStop    = document.querySelector<HTMLButtonElement>("#fg-stop")!;

function ensureOption(select: HTMLSelectElement, value: string) {
  const exists = Array.from(select.options).some(o => o.value === value);
  if (!exists) {
    const opt = document.createElement("option");
    opt.value = value; opt.textContent = value;
    select.appendChild(opt);
  }
}

function removeSelected(select: HTMLSelectElement) {
  const keep: HTMLOptionElement[] = [];
  for (const opt of Array.from(select.options)) {
    if (!opt.selected) keep.push(opt);
  }
  select.innerHTML = "";
  for (const opt of keep) select.appendChild(opt);
}

function addFromNeutral(target: "allow" | "block") {
  const src = elNeutral;
  const dst = target === "allow" ? elAllow : elBlock;
  const other = target === "allow" ? elBlock : elAllow;

  const selected = Array.from(src.selectedOptions).map(o => o.value);

  for (const v of selected) {
    const inOther = Array.from(other.options).some(o => o.value === v);
    if (target === "allow" && inOther) {
      continue;
    }
    if (target === "block") {
      const toRemove = Array.from(elAllow.options).find(o => o.value === v);
      if (toRemove) toRemove.remove();
    }
    ensureOption(dst, v);
  }
}

// buttons
document.getElementById("fg-to-allow")!.addEventListener("click", () => addFromNeutral("allow"));
document.getElementById("fg-to-block")!.addEventListener("click", () => addFromNeutral("block"));
document.getElementById("fg-rm-allow")!.addEventListener("click", () => removeSelected(elAllow));
document.getElementById("fg-rm-block")!.addEventListener("click", () => removeSelected(elBlock));

elNeutral.addEventListener("dblclick", (ev) => {
  const e = ev as MouseEvent;
  if (e.shiftKey) addFromNeutral("block");
  else addFromNeutral("allow");
});

  fillSelect(elNeutral, BASE_CATEGORIES);

  const ex = await loadExisting();
  if (ex?.minutes) elMinutes.value = String(ex.minutes);
  if (typeof ex?.consent === "boolean") elConsent.checked = ex.consent;

  const savedAllow = ex?.profile?.allow ?? [];
  const savedBlock = ex?.profile?.block ?? [];
  fillSelect(elAllow, savedAllow);
  fillSelect(elBlock, savedBlock);

  let timer: number | undefined;
  async function renderStatus() {
    const endAt = await getActiveEnd();
    if (endAt) {
      const rem = endAt - Date.now();
      elStatus.textContent = `セッション中 — 残り ${fmt(rem)}`;
      elSave.disabled = true;
      elClear.disabled = true;
      elMinutes.disabled = true;
      elConsent.disabled = true;
      elAllow.disabled = true;
      elBlock.disabled = true;
      elGoal.disabled = true;
      elStop.hidden = false;
      if (timer) clearInterval(timer);
      timer = window.setInterval(() => {
        const left = endAt - Date.now();
        if (left <= 0) {
          clearInterval(timer);
          elStatus.textContent = "セッション終了";
          elStop.hidden = true;
          elSave.disabled = false;
          elClear.disabled = false;
          elMinutes.disabled = false;
          elConsent.disabled = false;
          elAllow.disabled = false;
          elBlock.disabled = false;
          elGoal.disabled = false;
        } else {
          elStatus.textContent = `セッション中 — 残り ${fmt(left)}`;
        }
      }, 1000);
    } else {
      elStatus.textContent = "待機中（セッション未開始）";
      elSave.disabled = false;
      elClear.disabled = false;
      elMinutes.disabled = false;
      elConsent.disabled = false;
      elAllow.disabled = false;
      elBlock.disabled = false;
      elGoal.disabled = false;
      elStop.hidden = true;
      if (timer) clearInterval(timer);
    }
  }
  await renderStatus();

  elSave.onclick = async () => {
    const active = await getActiveEnd();
    if (active) {
      alert("すでにセッション中です。停止してから再度開始してください。");
      return;
    }
    const minutes = Math.max(1, Math.floor(Number(elMinutes.value) || 30));
    const consent = elConsent.checked;
    const profile = normalizeProfile(getSelected(elAllow), getSelected(elBlock));
    const goal = (elGoal.value || "").trim();
    if (!goal) { alert("Goal は必須です。"); return; }
    const endAt = Date.now() + minutes * 60_000;

    const goalClamped = goal.slice(0, 300);

    await chrome.storage.local.set({
      fg_minutes: minutes,
      fg_consent: consent,
      fg_profile: profile,
      fg_goal: goalClamped,
      fg_session_endAt: endAt,
    });

    try { await chrome.runtime.sendMessage({ type: "FG_FORCE_CHECK" }); } catch {}
    window.close();
  };

  elClear.onclick = async () => {
    const active = await getActiveEnd();
    if (active) return;
    elMinutes.value = "30";
    elConsent.checked = false;
    fillSelect(elAllow, []);
    fillSelect(elBlock, []);
    elGoal.value = "";
  };

  elStop.onclick = async () => {
    await chrome.storage.local.set({ fg_session_endAt: Date.now() });
    await chrome.storage.local.remove(["fg_goal"]);
    await renderStatus();
  };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if ("fg_session_endAt" in changes) renderStatus();
  });
}

main().catch(console.error);
