import { embedStub } from "./embeddings";
import { loadThresholds } from "./config";
import OpenAI from "openai";

const { goalAllow } = loadThresholds();
const GOAL_ALLOW = typeof goalAllow === "number" ? goalAllow : 0.75; 

export type Verdict = "ALLOW" | "BLOCK" | "REVIEW";

export type Norm = {
  url: string;
  domain: string;
  title?: string;
  description?: string;
  snippet?: string;
  jsonld?: string;
};

export type FocusProfile = {
  allow: string[];
  block: string[];
};

export type FocusIntent = {
  goal?: string;
};

export type Judgment = {
  verdict: Verdict;
  confidence: number;
  categories: string[];
  reasons: string[];
  path: "A" | "B" | "C";
  metrics?: {
    goalSimApprox?: number;
    ruleHits?: { allow: number; block: number; neutral: number };
  };
};

// ---------------- A-stage judging ----------------
function bag(norm: Norm): string {
  return [
    norm.title || "",
    norm.description || "",
    norm.snippet || "",
    norm.url || "",
    norm.domain || "",
  ]
    .join("\n")
    .toLowerCase();
}

const ALLOW_HINTS = [
  "math",
  "mathematics",
  "cs",
  "computer science",
  "research",
  "paper",
  "data science",
];

const BLOCK_HINTS = [
  "game",
  "gaming",
  "let's play",
  "stream",
  "walkthrough",
  "gacha",
];

const NEUTRAL_HINTS = ["news", "blog", "shopping", "ec"];

function dot(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

function countHits(ws: string[] | undefined, text: string): number {
  if (!ws || ws.length === 0) return 0;
  const uniq = Array.from(new Set(ws.map(w => (w || "").toLowerCase()).filter(Boolean)));
  let c = 0;
  for (const w of uniq) if (text.includes(w)) c++;
  return c;
}
// ---------------- A-stage (precision-first gating) ----------------
export function judgeA(norm: Norm, profile: FocusProfile, intent?: FocusIntent): Judgment {
  const text = bag(norm);
  const hit = (ws: string[]) => (ws || []).some((w) => w && text.includes(w.toLowerCase()));

  const goal = (intent?.goal || "").trim();
  const goalSim = goal ? dot(embedStub(goal), embedStub(text)) : undefined;

  const ruleHits = {
    allow: countHits(profile.allow, text) + countHits(ALLOW_HINTS, text),
    block: countHits(profile.block, text) + countHits(BLOCK_HINTS, text),
    neutral: countHits(NEUTRAL_HINTS as string[], text),
  };

  if (hit(profile.block)) {
    return {
      verdict: "BLOCK",
      confidence: 0.8,
      categories: ["profile:block"],
      reasons: ["profile_block_match"],
      path: "A",
      metrics: { goalSimApprox: goalSim, ruleHits },
    };
  }
  if (hit(BLOCK_HINTS)) {
    return {
      verdict: "BLOCK",
      confidence: 0.75,
      categories: ["gaming?"],
      reasons: ["block_hints"],
      path: "A",
      metrics: { goalSimApprox: goalSim, ruleHits },
    };
  }

  if (hit(profile.allow)) {
    return {
      verdict: "ALLOW",
      confidence: 0.7,
      categories: ["profile:allow"],
      reasons: ["profile_allow_match"],
      path: "A",
      metrics: { goalSimApprox: goalSim, ruleHits },
    };
  }

  if (goal) {
    if ((goalSim ?? 0) >= GOAL_ALLOW) {
      return {
        verdict: "ALLOW",
        confidence: 0.72,
        categories: ["goal"],
        reasons: ["goal_similarity_hi"],
        path: "A",
        metrics: { goalSimApprox: goalSim, ruleHits },
      };
    }
  }

  if (hit(NEUTRAL_HINTS)) {
    return {
      verdict: "REVIEW",
      confidence: 0.55,
      categories: ["neutral"],
      reasons: ["neutral_hints"],
      path: "A",
      metrics: { goalSimApprox: goalSim, ruleHits },
    };
  }

  return {
    verdict: "REVIEW",
    confidence: 0.5,
    categories: [],
    reasons: ["insufficient_signal"],
    path: "A",
    metrics: { goalSimApprox: goalSim, ruleHits },
  };
}

// ---------------- B-stage (OpenAI refinement via Chat Completions) ----------------
export async function judgeB(
  norm: Norm,
  profile: FocusProfile,
  intent?: FocusIntent,
  aJudgment?: Judgment,
  modelName = process.env.FG_B_MODEL || "gpt-4o-mini" 
): Promise<Judgment> {

  const goal = (intent?.goal || "").trim();
  if (!goal) {
    return { verdict: "REVIEW", confidence: 0.5, categories: [], reasons: ["no_goal"], path: "B" };
  }

  const text = bag(norm).slice(0, 4000);
  const allowList = (profile.allow || []).join(", ").slice(0, 400);
  const blockList = (profile.block || []).join(", ").slice(0, 400);

  const goalSimApprox = Number(dot(embedStub(goal), embedStub(text)).toFixed(4));

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const judgmentSchema = {
  name: "FocusGuardJudgment",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      verdict: { type: "string", enum: ["ALLOW", "BLOCK", "REVIEW"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      categories: { type: "array", items: { type: "string" } },
      reasons: { type: "array", items: { type: "string" } },
    },
    required: ["verdict", "confidence", "categories", "reasons"],
  },
  strict: true,
} as const;

  const system =
`You are FocusGuard-B, the second-stage judge.
Return ONLY a JSON object conforming to the provided JSON schema.
Decision policy:
- Priority: Goal = Block > Allow. If page strongly matches both Goal and Block, return BLOCK.
- ALLOW if content clearly helps the user's goal (study/work intent).
- BLOCK if it clearly distracts from the goal (e.g., gaming/entertainment/short-form binges).
- Otherwise REVIEW (abstain).
Use short, machine-parseable "reasons" tags: e.g., "goal_match","block_hint","ambiguous".`;

  const user =
`USER_GOAL:
${goal}

PROFILE_ALLOW: [${allowList}]
PROFILE_BLOCK: [${blockList}]

PAGE_CONTEXT:
URL: ${norm.url}
TITLE: ${norm.title || ""}
DESC: ${norm.description || ""}
SNIPPET: ${norm.snippet || ""}

NOTES:
- A-stage verdict: ${aJudgment?.verdict ?? "REVIEW"}
- local_goal_sim (approx): ${goalSimApprox}
Return ONLY JSON (no markdown, no extra text).`;

  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 5000);

  try {
    const completion = await client.chat.completions.create(
      {
        model: modelName, 
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: {
          type: "json_schema",
          json_schema: judgmentSchema,
        },
        max_tokens: 200,
        temperature: 0.2,
      },
      { signal: ctrl.signal }
    );

    const raw = completion.choices?.[0]?.message?.content ?? "";
    let parsed: any = null;
    try {
      parsed = JSON.parse(typeof raw === "string" ? raw : String(raw));
    } catch {
      return { verdict: "REVIEW", confidence: 0.5, categories: [], reasons: ["b_invalid_json"], path: "B" };
    }

    const v = parsed?.verdict === "ALLOW" || parsed?.verdict === "BLOCK" ? parsed.verdict : "REVIEW";
    const conf = Math.min(1, Math.max(0, Number(parsed?.confidence ?? 0.6)));
    const cats: string[] = Array.isArray(parsed?.categories) ? parsed.categories.slice(0, 5) : [];
    const reasons: string[] = Array.isArray(parsed?.reasons) && parsed.reasons.length ? parsed.reasons : ["b_no_reason"];

    return { verdict: v as Verdict, confidence: conf, categories: cats, reasons, path: "B" };
  } catch (e: any) {
    const status = e?.status || e?.response?.status;
    const name   = e?.name;
    const msg    = e?.message || e?.error?.message;
    const data   = e?.response?.data;
    console.error("[judgeB] OpenAI error:", { status, name, msg, data });

    const isAbort = name === "AbortError";
    return {
      verdict: "REVIEW",
      confidence: 0.5,
      categories: [],
      reasons: [isAbort ? "b_timeout" : "b_error"],
      path: "B",
    };
  } finally {
    clearTimeout(to);
  }
}


