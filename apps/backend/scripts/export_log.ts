// apps/backend/scripts/export_logs.ts
// Merge daily JSONL files -> single CSV.
// Usage: ts-node export_logs.ts [days=7]

import fs from "fs";
import path from "path";
import readline from "readline";
// export_log.ts (ハッカソン用の簡易版)

export type Verdict = "ALLOW" | "BLOCK" | "REVIEW";

export interface RuleHits {
  allow: number;
  block: number;
  neutral: number;
}

export interface JudgmentLogEntry {
  timestamp: string;
  domain: string;
  url_hash: string;
  stage: "A" | "B";
  verdict: Verdict;
  latency_ms: number;
  timeout_flag?: boolean;
  goalSimApprox?: number;
  rule_hits?: RuleHits;
  title_len?: number;
  snippet_len?: number;
  jsonld_present?: boolean;
  model_name?: string;
  build_id?: string;
}


const LOG_DIR = process.env.FG_LOG_DIR || path.resolve(process.cwd(), "logs");
const DAYS = Number(process.argv[2] || 7);

function isTarget(filename: string) { return /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(filename); }
function isWithinDays(filename: string): boolean {
  const day = new Date(filename.slice(0, 10) + "T00:00:00Z");
  const cut = new Date(); cut.setUTCDate(cut.getUTCDate() - DAYS); cut.setUTCHours(0,0,0,0);
  return day >= cut;
}

(async () => {
  if (!fs.existsSync(LOG_DIR)) { console.error("No logs dir"); process.exit(0); }
  const files = fs.readdirSync(LOG_DIR).filter(isTarget).filter(isWithinDays).sort();
  const out = fs.createWriteStream(path.join(LOG_DIR, "judgments.csv"), { encoding: "utf8" });
  out.write([
    "timestamp","domain","url_hash","stage","verdict","latency_ms","timeout_flag",
    "goalSimApprox","rule_allow","rule_block","rule_neutral",
    "title_len","snippet_len","jsonld_present","model_name","build_id"
  ].join(",") + "\n");

  const esc = (v: unknown) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };

  for (const f of files) {
    const rl = readline.createInterface({
      input: fs.createReadStream(path.join(LOG_DIR, f), { encoding: "utf8" }),
      crlfDelay: Infinity
    });
    for await (const line of rl) {
      const s = line.trim(); if (!s) continue;
      try {
        const e = JSON.parse(s) as JudgmentLogEntry;
        const rh = e.rule_hits || { allow: "", block: "", neutral: "" };
        const cols = [
          e.timestamp, e.domain, e.url_hash, e.stage, e.verdict, e.latency_ms, e.timeout_flag ?? "",
          e.goalSimApprox ?? "", rh.allow, rh.block, rh.neutral,
          e.title_len ?? "", e.snippet_len ?? "", e.jsonld_present ?? "",
          e.model_name ?? "", e.build_id ?? ""
        ];
        out.write(cols.map(esc).join(",") + "\n");
      } catch { /* skip broken line */ }
    }
  }
  out.end();
  out.on("finish", () => console.log("Wrote:", path.join(LOG_DIR, "judgments.csv")));
})();
