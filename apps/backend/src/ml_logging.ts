import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { JudgmentLogEntry, RuleHits } from "./types.log";

const LOG_DIR = process.env.FG_LOG_DIR || path.resolve(process.cwd(), "logs");

function dayFile(day = new Date()): string {
  const yyyy = day.getUTCFullYear();
  const mm = String(day.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(day.getUTCDate()).padStart(2, "0");
  return path.join(LOG_DIR, `${yyyy}-${mm}-${dd}.jsonl`);
}

function ensureDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex").slice(0, 16);
}

function deriveSignals(norm: { url: string; title?: string; snippet?: string; jsonld?: string }) {
  let domain = "";
  try { domain = new URL(norm.url).hostname || ""; } catch {}
  return {
    domain,
    url_hash: hashUrl(norm.url),
    title_len: norm.title ? norm.title.length : 0,
    snippet_len: norm.snippet ? norm.snippet.length : 0,
    jsonld_present: !!norm.jsonld,
  };
}

async function appendJSONL(row: JudgmentLogEntry) {
  try {
    ensureDir();
    await fs.promises.appendFile(dayFile(), JSON.stringify(row) + "\n", "utf8");
  } catch {
  }
}

export async function writeAStageLog(args: {
  startedAt: number;
  norm: { url: string; title?: string; snippet?: string; jsonld?: string };
  verdict: "ALLOW" | "BLOCK" | "REVIEW";
  goalSimApprox?: number;
  ruleHits?: RuleHits;
  modelName?: string;
  buildId?: string;
}) {
  const latency = Date.now() - args.startedAt;
  const d = deriveSignals(args.norm);
  const row: JudgmentLogEntry = {
    timestamp: new Date(args.startedAt).toISOString(),
    domain: d.domain,
    url_hash: d.url_hash,
    stage: "A",
    verdict: args.verdict,
    latency_ms: latency,
    goalSimApprox: args.goalSimApprox,
    rule_hits: args.ruleHits,
    title_len: d.title_len,
    snippet_len: d.snippet_len,
    jsonld_present: d.jsonld_present,
    model_name: args.modelName || "A-heuristic",
    build_id: args.buildId,
  };
  await appendJSONL(row);
}

export async function writeBStageLog(args: {
  startedAt: number;
  norm: { url: string; title?: string; snippet?: string; jsonld?: string };
  verdict: "ALLOW" | "BLOCK" | "REVIEW";
  timeout?: boolean;
  modelName?: string;
  buildId?: string;
}) {
  const latency = Date.now() - args.startedAt;
  const d = deriveSignals(args.norm);
  const row: JudgmentLogEntry = {
    timestamp: new Date(args.startedAt).toISOString(),
    domain: d.domain,
    url_hash: d.url_hash,
    stage: "B",
    verdict: args.verdict,
    latency_ms: latency,
    timeout_flag: !!args.timeout,
    title_len: d.title_len,
    snippet_len: d.snippet_len,
    jsonld_present: d.jsonld_present,
    model_name: args.modelName,
    build_id: args.buildId,
  };
  await appendJSONL(row);
}
