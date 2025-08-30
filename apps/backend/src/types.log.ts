export type Verdict = "ALLOW" | "BLOCK" | "REVIEW";
export interface RuleHits { allow: number; block: number; neutral: number; }

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
