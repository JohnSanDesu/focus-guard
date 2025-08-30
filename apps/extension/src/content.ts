import { planChecks, watchNavChanges } from "./scheduler";
import { extractMinimum } from "./extract";
import { showToast } from "./toast";
import type { FocusProfile, Judgment } from "./types";

const BACKEND = "http://localhost:8787";
const CHECK_MIN_INTERVAL_MS = 15_000;

let running = false;
let lastCheckAt = 0;

let judgeInFlight = false;
let judgeCooldownUntil = 0;

let stopWatchNav: (() => void) | null = null;

console.log("[FG] content boot");

async function sessionEndAt(): Promise<number | null> {
  return new Promise((res) => {
    chrome.storage.local.get(["fg_session_endAt"], (d) => {
      const t = d?.fg_session_endAt;
      res(typeof t === "number" ? t : null);
    });
  });
}
async function sessionActive(): Promise<boolean> {
  const t = await sessionEndAt();
  return !!(t && t > Date.now());
}

async function getSession(): Promise<{
  minutes: number;
  consent: boolean;
  profile: FocusProfile;
  goal: string;
  endAt: number;
} | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      ["fg_minutes", "fg_consent", "fg_profile", "fg_goal", "fg_session_endAt"],
      (data) => {
        const p = data?.fg_profile as any;
        const goal = typeof data?.fg_goal === "string" ? data.fg_goal.trim() : "";
        const endAt = typeof data?.fg_session_endAt === "number" ? data.fg_session_endAt : 0;
        if (!p || !Array.isArray(p.allow) || !Array.isArray(p.block) || !goal) {
          return resolve(null);
        }
        if (!endAt || endAt <= Date.now()) return resolve(null);
        resolve({
          minutes: Number(data.fg_minutes) || 30,
          consent: Boolean(data.fg_consent),
          profile: { allow: p.allow, block: p.block },
          goal,
          endAt,
        });
      }
    );
  });
}

async function getSettingsRaw(): Promise<{
  minutes: number;
  consent: boolean;
  profile: FocusProfile;
  goal: string;
}> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["fg_minutes", "fg_consent", "fg_profile", "fg_goal"], (data) => {
      const p = (data?.fg_profile as any) || { allow: [], block: [] };
      const goal = typeof data?.fg_goal === "string" ? data.fg_goal.trim() : "";
      resolve({
        minutes: Number(data?.fg_minutes) || 30,
        consent: Boolean(data?.fg_consent),
        profile: {
          allow: Array.isArray(p.allow) ? p.allow : [],
          block: Array.isArray(p.block) ? p.block : [],
        },
        goal,
      });
    });
  });
}

type PostResp = { ok: boolean; status: number; data?: any; error?: string };

function postViaSW(url: string, body: unknown, timeoutMs: number): Promise<PostResp> {
  return new Promise((resolve) => {
    const to = setTimeout(() => resolve({ ok: false, status: 0, error: "timeout" }), timeoutMs);
    try {
      chrome.runtime.sendMessage(
        { type: "FG_FETCH_JSON", url, body },
        (resp: PostResp | undefined) => {
          clearTimeout(to);
          resolve(resp || { ok: false, status: 0, error: "no_response" });
        }
      );
    } catch (e) {
      clearTimeout(to);
      resolve({ ok: false, status: 0, error: String(e) });
    }
  });
}

async function postDirect(url: string, body: unknown, timeoutMs: number): Promise<PostResp> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await r
      .json()
      .catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  } finally {
    clearTimeout(t);
  }
}

async function postJSON(path: string, body: unknown, timeoutMs = 5500): Promise<PostResp> {
  const viaSW = await postViaSW(`${BACKEND}${path}`, body, timeoutMs);
  if (viaSW.ok || viaSW.status !== 0) return viaSW;
  const direct = await postDirect(`${BACKEND}${path}`, body, timeoutMs);
  return direct;
}

// ---------- main judge flow ----------
async function runCheck(profile: FocusProfile, consent: boolean, goal: string) {
  if (!(await sessionActive())) {
    console.log("[FG] runCheck abort: session inactive (endAt missing/expired)");
    return;
  }

  const now = Date.now();
  if (now - lastCheckAt < CHECK_MIN_INTERVAL_MS) {
    return;
  }
  lastCheckAt = now;

  if (consent) {
    try {
      await chrome.runtime.sendMessage({ type: "CAPTURE_FOR_CHECK" });
    } catch {
      /* ignore */
    }
  }

  const norm = await extractMinimum();

  // ---- A stage ----
  let a: Judgment;
  try {
    const body = { norm, profile, intent: { goal } };
    const resp = await postJSON("/score", body, 5500);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.error || ""}`);
    a = resp.data as Judgment;
  } catch {
    a = {
      verdict: "REVIEW",
      confidence: 0.5,
      categories: [],
      reasons: ["backend_error"],
      path: "A",
    };
  }

  // A=ALLOW → no UI
  if (a.verdict === "ALLOW") return;

  // A=BLOCK → warn
  if (a.verdict === "BLOCK") {
    showToast("FocusGuard: This looks off-purpose. Stop now?", [
      { label: "Stop", danger: true, onClick: () => { location.href = "about:blank"; } },
      { label: "Continue", onClick: () => {} },
    ]);
    return;
  }

  // ---- B stage (only when A=REVIEW) ----
  if (judgeInFlight || Date.now() < judgeCooldownUntil) {
    showToast("FocusGuard: Unsure if this fits your goal. Continue?", [
      { label: "Continue", onClick: () => {} },
      { label: "Stop", danger: true, onClick: () => { location.href = "about:blank"; } },
      { label: "Snooze 5m", onClick: () => { setTimeout(() => runCheck(profile, consent, goal), 5 * 60 * 1000); } },
    ]);
    return;
  }

  judgeInFlight = true;
  let b: Judgment | null = null;
  try {
    const body = { norm, profile, intent: { goal }, aJudgment: a };
    const resp = await postJSON("/judge", body, 5000); // 5s SLA
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.error || ""}`);
    b = resp.data as Judgment;
  } catch {
    b = {
      verdict: "REVIEW",
      confidence: 0.5,
      categories: [],
      reasons: ["b_error"],
      path: "B",
    };
  } finally {
    judgeInFlight = false;
    judgeCooldownUntil = Date.now() + 15_000;
  }

  if (!b || b.verdict === "ALLOW") return;

  if (b.verdict === "BLOCK") {
    showToast("FocusGuard: This looks off-purpose. Stop now?", [
      { label: "Stop", danger: true, onClick: () => { location.href = "about:blank"; } },
      { label: "Continue", onClick: () => {} },
    ]);
    return;
  }

  showToast("FocusGuard: Unsure if this fits your goal. Continue?", [
    { label: "Continue", onClick: () => {} },
    { label: "Stop", danger: true, onClick: () => { location.href = "about:blank"; } },
    { label: "Snooze 5m", onClick: () => { setTimeout(() => runCheck(profile, consent, goal), 5 * 60 * 1000); } },
  ]);
}

async function startSession(
  minutes: number,
  profile: FocusProfile,
  consent: boolean,
  goal: string,
  endAt: number
) {
  if (running) return;
  running = true;
  console.log("[FG] session start", {
    minutes,
    consent,
    allow: profile.allow,
    block: profile.block,
    goal,
  });

  chrome.runtime.sendMessage({ type: "FG_SCHEDULE_SESSION_END", endAt }).catch(() => {});

  runCheck(profile, consent, goal).catch(() => {});

  const durationMs = Math.max(0, endAt - Date.now());
  const N = Math.max(3, Math.floor((durationMs / 60_000) / 5) || 1);
  const plan = planChecks(durationMs, N);
  const t0 = Date.now();
  for (const offset of plan) {
    setTimeout(() => runCheck(profile, consent, goal), Math.max(0, t0 + offset - Date.now()));
  }

  if (stopWatchNav) {
    try {
      stopWatchNav();
    } catch {}
  }
  stopWatchNav = watchNavChanges(() => runCheck(profile, consent, goal), {
    minIntervalMs: CHECK_MIN_INTERVAL_MS,
  });
}

(async () => {
  try {
    await chrome.runtime.sendMessage({ type: "PING" }).catch(() => undefined);

    const sess = await getSession();
    if (sess) startSession(sess.minutes, sess.profile, sess.consent, sess.goal, sess.endAt);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (
        "fg_minutes" in changes ||
        "fg_profile" in changes ||
        "fg_consent" in changes ||
        "fg_goal" in changes ||
        "fg_session_endAt" in changes
      ) {
        getSession().then((s) => {
          if (!s) {
            if (running && "fg_session_endAt" in changes) {
              running = false;
              if (stopWatchNav) {
                try {
                  stopWatchNav();
                } catch {}
                stopWatchNav = null;
              }
              chrome.runtime.sendMessage({ type: "FG_CANCEL_SESSION_END" }).catch(() => {});
            }
            return;
          }
          if (!running) startSession(s.minutes, s.profile, s.consent, s.goal, s.endAt);
        });
      }
    });
  } catch (e) {
    console.warn("[FG] content init error", e);
  }
})();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "FG_FORCE_CHECK") {
    console.log("[FG] got FG_FORCE_CHECK");
    getSession().then((s) => {
      if (!s) {
        console.warn("[FG] no active session (fg_session_endAt missing/expired).");
        sendResponse({ ok: false, reason: "no_active_session" });
        return;
      }
      runCheck(s.profile, s.consent, s.goal)
        .then(() => sendResponse({ ok: true }))
        .catch((e) => {
          console.warn("[FG] runCheck error", e);
          sendResponse({ ok: false, error: String(e) });
        });
    });
    return true; 
  }

  if (msg?.type === "FG_SESSION_FINISHED") {
    running = false;
    if (stopWatchNav) {
      try {
        stopWatchNav();
      } catch {}
      stopWatchNav = null;
    }

    chrome.storage.local.remove(["fg_session_endAt", "fg_goal"], () => {});
    chrome.runtime.sendMessage({ type: "FG_CANCEL_SESSION_END" }).catch(() => {});

    showToast("FocusGuard session finished. Extend, break, or stop?", [
      {
        label: "Extend",
        onClick: () => {
          getSettingsRaw().then((raw) => {
            const minutes = Number(raw.minutes) || 30;
            const goal = (raw.goal || "").trim();
            const profile = raw.profile || { allow: [], block: [] };

            const newEnd = Date.now() + minutes * 60_000;
            chrome.storage.local.set({ fg_session_endAt: newEnd, fg_goal: goal }, () => {
              chrome.runtime
                .sendMessage({ type: "FG_SCHEDULE_SESSION_END", endAt: newEnd })
                .catch(() => {});
              startSession(minutes, profile, Boolean(raw.consent), goal, newEnd);
            });
          });
        },
      },
      { label: "Break", onClick: () => {} },
      { label: "Stop", onClick: () => {} },
    ]);
  }
});
