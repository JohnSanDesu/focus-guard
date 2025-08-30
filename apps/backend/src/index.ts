import { logEvent, logBoot } from "./logging";
import { writeAStageLog, writeBStageLog } from "./ml_logging";
import "dotenv/config";
import express from "express";
import cors from "cors";
import { loadPrototypes, loadThresholds } from "./config";
import {
  judgeA,
  judgeB,
  type FocusProfile,
  type Norm,
  type Judgment,
  type FocusIntent,
} from "./scoring";

console.log("[FG-backend] boot");

if (!process.env.OPENAI_API_KEY) {
  console.warn("[FG-backend] WARN: OPENAI_API_KEY is not set. /judge will return REVIEW.");
}
const B_MODEL = process.env.FG_B_MODEL || "gpt-4o-mini";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const thresholds = loadThresholds();
const prototypes = loadPrototypes();
console.log("[FG-backend] thresholds:", thresholds);
console.log("[FG-backend] prototypes keys:", Object.keys(prototypes).length);

logBoot({ bModel: B_MODEL, thresholds, openaiKeySet: !!process.env.OPENAI_API_KEY });

app.get("/ping", (_req, res) => res.json({ ok: true }));

// ---------------- A-stage scoring ----------------
app.post("/score", (req, res) => {
  const t0 = Date.now();
  const { norm, profile, intent } = req.body as {
    norm?: Norm;
    profile?: FocusProfile;
    intent?: FocusIntent;
  };
  if (!norm?.url || !norm?.domain || !profile) {
    return res.status(400).json({ error: "bad_request" });
  }
  try {
    const j: Judgment = judgeA(norm, profile, intent);

    void writeAStageLog({
      startedAt: t0,
      norm,
      verdict: j.verdict,
      goalSimApprox: j.metrics?.goalSimApprox,
      ruleHits: j.metrics?.ruleHits,
      modelName: "A-heuristic",
      buildId: process.env.BUILD_ID,
    });

    logEvent({
      ts: new Date().toISOString(),
      route: "score",
      verdict: j.verdict,
      latency_ms: Date.now() - t0,
      reasons: j.reasons?.slice(0, 4),
      domain: norm.domain,
    });

    return res.json(j);
  } catch (e) {
    console.error("[/score] error:", e);
    return res.status(500).json({ error: "internal_error" });
  }
});

// ---------------- B-stage judging (LLM; 5s SLA inside judgeB) ----------------
app.post("/judge", async (req, res) => {
  const t0 = Date.now();
  const { norm, profile, intent, aJudgment } = req.body as {
    norm?: Norm;
    profile?: FocusProfile;
    intent?: FocusIntent;
    aJudgment?: Judgment;
  };
  if (!norm?.url || !norm?.domain || !profile) {
    return res.status(400).json({ error: "bad_request" });
  }
  try {
    if (!process.env.OPENAI_API_KEY) {
      const j: Judgment = {
        verdict: "REVIEW",
        confidence: 0.5,
        categories: [],
        reasons: ["no_api_key"],
        path: "B",
      };

      void writeBStageLog({
        startedAt: t0,
        norm,
        verdict: j.verdict,
        timeout: false,
        modelName: B_MODEL,
        buildId: process.env.BUILD_ID,
      });

      logEvent({
        ts: new Date().toISOString(),
        route: "judge",
        verdict: j.verdict,
        latency_ms: Date.now() - t0,
        reasons: j.reasons,
        domain: norm.domain,
        model: B_MODEL,
      });

      return res.json(j);
    }

    const j = await judgeB(norm, profile, intent, aJudgment);

    void writeBStageLog({
      startedAt: t0,
      norm,
      verdict: j.verdict,
      timeout: j.reasons?.includes("b_timeout"),
      modelName: B_MODEL,
      buildId: process.env.BUILD_ID,
    });

    logEvent({
      ts: new Date().toISOString(),
      route: "judge",
      verdict: j.verdict,
      latency_ms: Date.now() - t0,
      reasons: j.reasons?.slice(0, 4),
      domain: norm.domain,
      model: B_MODEL,
      timeout: j.reasons?.includes("b_timeout"),
    });

    return res.json(j);
  } catch (e) {
    console.error("[/judge] error:", e);

    void writeBStageLog({
      startedAt: t0,
      norm: norm!, 
      verdict: "REVIEW",
      timeout: true,
      modelName: B_MODEL,
      buildId: process.env.BUILD_ID,
    });

    logEvent({
      ts: new Date().toISOString(),
      route: "judge",
      verdict: "REVIEW",
      latency_ms: Date.now() - t0,
      reasons: ["b_error"],
      domain: norm?.domain,
      model: B_MODEL,
    });

    return res.status(500).json({ error: "internal_error" });
  }
});

// ---------------- C-stage placeholder ----------------
app.post("/vqa", (_req, res) =>
  res.json({
    verdict: "REVIEW",
    confidence: 0.5,
    categories: [],
    reasons: ["not_implemented"],
    path: "C",
  })
);

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`[FG-backend] listening on :${port}`);
});

process.on("uncaughtException", (e) => {
  console.error("[FG-backend] uncaughtException:", e);
});
process.on("unhandledRejection", (e) => {
  console.error("[FG-backend] unhandledRejection:", e);
});
