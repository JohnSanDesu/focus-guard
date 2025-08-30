import type { RuleHits } from "./types.log";

export type FGRoute = "score" | "judge";
export type FGVerdict = "ALLOW" | "BLOCK" | "REVIEW";
export type UserAction = "start" | "stop" | "pause" | "resume" | "timeout" | "noop";
export interface FGLog {
  ts?: string;

  route: FGRoute;
  verdict: FGVerdict;
  latency_ms: number;

  reasons?: string[];
  timeout?: boolean;
  domain?: string;
  model?: string;

  goalSimApprox?: number;
  title_len?: number;
  snippet_len?: number;
  rule_hits?: RuleHits;
  minutes_remaining?: number;
  user_action?: UserAction;
}

const enabled = process.env.FG_DEBUG === "1";

export function logEvent(ev: FGLog) {
  if (!enabled) return;
  const rec: FGLog & { ts: string } = { ...ev, ts: ev.ts ?? new Date().toISOString() };
  if (Array.isArray(rec.reasons)) rec.reasons = rec.reasons.slice(0, 6);
  console.log("[FG]", JSON.stringify(rec));
}

export function logBoot(info: Record<string, unknown>) {
  if (!enabled) return;
  console.log("[FG-boot]", JSON.stringify(info));
}
