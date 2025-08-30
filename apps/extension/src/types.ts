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
  goal: string;
};

export type Verdict = "ALLOW" | "BLOCK" | "REVIEW";

export type Judgment = {
  verdict: Verdict;
  confidence: number;    
  categories: string[];  
  reasons: string[];     
  path: string;          
};

export type FocusSignals = {
  navChangeRecent?: boolean;
  pageLang?: string;
  activeMs?: number;
};