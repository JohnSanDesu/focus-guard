/// <reference types="chrome" />


console.log("[FG] SW loaded (top-level)");

chrome.runtime.onInstalled.addListener((info) => {
  console.log("[FG] onInstalled:", info.reason);
});
chrome.runtime.onStartup.addListener(() => {
  console.log("[FG] onStartup");
});

type CacheRec = { dataUrl: string; ts: number };
const cache: Record<string, CacheRec | undefined> = Object.create(null);
const TTL_MS = 30_000;

function purge() {
  const now = Date.now();
  for (const [k, rec] of Object.entries(cache)) {
    if (!rec || now - rec.ts > TTL_MS) delete cache[k];
  }
}

function saveCapture(dataUrl: string): string {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  cache[key] = { dataUrl, ts: Date.now() };
  purge();
  return key;
}

const SESSION_ALARM = "fg_session_end";
const ENABLE_SYSTEM_NOTIFICATION = false;

function scheduleSessionEnd(endAt: number) {
  try {
    chrome.alarms.create(SESSION_ALARM, { when: endAt });
    console.log("[FG] alarm scheduled:", new Date(endAt).toISOString());
  } catch (e) {
    console.warn("[FG] failed to schedule alarm:", e);
  }
}

function cancelSessionEnd() {
  chrome.alarms.clear(SESSION_ALARM, (ok) => {
    console.log("[FG] alarm cleared:", ok);
  });
}

function broadcastToAllTabs(message: any) {
  chrome.tabs.query({}, (tabs) => {
    for (const t of tabs) {
      if (t.id != null) {
        try {
          chrome.tabs.sendMessage(t.id, message);
        } catch {}
      }
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== SESSION_ALARM) return;

  console.log("[FG] session end alarm fired");

  broadcastToAllTabs({ type: "FG_SESSION_FINISHED" });
  if (ENABLE_SYSTEM_NOTIFICATION) {
    try {
      chrome.notifications.create({
        type: "basic",
        iconUrl: "icon128.png",
        title: "FocusGuard",
        message: "Session finished.",
        priority: 2,
      });
    } catch (e) {
      console.warn("[FG] notifications create failed:", e);
    }
  }
});


chrome.runtime.onMessage.addListener((msg: any, sender, sendResponse) => {
  try {
    if (msg?.type === "PING") {
      sendResponse({ ok: true });
      return; 
    }

    if (msg?.type === "CAPTURE_FOR_CHECK") {
      chrome.tabs.captureVisibleTab({ format: "png" }, (dataUrl) => {
        if (chrome.runtime.lastError || !dataUrl) {
          sendResponse({
            ok: false,
            error: chrome.runtime.lastError?.message || "no image",
          });
          return;
        }
        const key = saveCapture(dataUrl);
        sendResponse({ ok: true, key });
      });
      return true; 
    }

    if (msg?.type === "GET_CAPTURE_BY_KEY") {
      const key = String(msg.key ?? "");
      const rec = cache[key];
      if (rec && Date.now() - rec.ts <= TTL_MS) {
        sendResponse({ ok: true, dataUrl: rec.dataUrl });
      } else {
        sendResponse({ ok: false, error: "expired_or_not_found" });
      }
      return; 
    }

    if (msg?.type === "FG_FORCE_CHECK") {
      const fromTabId = sender.tab?.id;
      if (typeof fromTabId === "number") {
        chrome.tabs.sendMessage(fromTabId, { type: "FG_FORCE_CHECK" });
        sendResponse({ ok: true, target: fromTabId });
        return; 
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const id = tabs[0]?.id ?? null;
        if (typeof id === "number") {
          chrome.tabs.sendMessage(id, { type: "FG_FORCE_CHECK" });
        }
        sendResponse({ ok: true, target: id });
      });
      return true; 
    }


    if (msg?.type === "FG_FETCH_JSON") {
      (async () => {
        try {
          const url: string = msg.url;
          const method: string = (msg.method || "POST").toUpperCase();
          const body = msg.body;

          if (typeof url !== "string" || !url) {
            sendResponse({ ok: false, status: 0, error: "bad_url" });
            return;
          }
          if (method !== "POST" && method !== "PUT" && method !== "PATCH" && method !== "DELETE" && method !== "GET") {
            sendResponse({ ok: false, status: 0, error: "bad_method" });
            return;
          }

          const init: RequestInit = {
            method,
            headers: { "content-type": "application/json" },
          };
          if (method !== "GET" && body !== undefined) {
            init.body = typeof body === "string" ? body : JSON.stringify(body);
          }

          const r = await fetch(url, init);
          let data: any = null;
          try {
            data = await r.json();
          } catch {

            data = null;
          }
          sendResponse({ ok: r.ok, status: r.status, data });
        } catch (e) {
          sendResponse({ ok: false, status: 0, error: String(e) });
        }
      })();
      return true; 
    }

    if (msg?.type === "FG_SCHEDULE_SESSION_END" && typeof msg.endAt === "number") {
      scheduleSessionEnd(msg.endAt);
      sendResponse({ ok: true });
      return; 
    }
    if (msg?.type === "FG_CANCEL_SESSION_END") {
      cancelSessionEnd();
      sendResponse({ ok: true });
      return; 
    }

    return;
  } catch (e) {
    console.warn("[FG] SW onMessage error:", e);
    try {
      sendResponse({ ok: false, error: String(e) });
    } catch {}
    return; 
  }
});
