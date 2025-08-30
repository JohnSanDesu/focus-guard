import fs from "node:fs";
import path from "node:path";

export type Thresholds = {
  allow: number;                
  block: number;                
  margin: number;               
  goalAllow?: number;           
  T_allow?: number;
  T_block?: number;
};

export type Prototypes = Record<string, string>;

export type Calibration =
  | { method: "platt"; a: number; b: number }
  | { method: "isotonic"; bins?: number }
  | { method: "none" };

export type LinearWeights = {
  features: string[];
  w: number[];
  b: number;
  calibration?: Calibration;
};

let _cfgDirMemo: string | null | undefined; 

function findFirstExisting(...candidates: string[]): string | null {
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return null;
}

function resolveCfgDir(): string | null {
  const envDir = process.env.FG_CONFIG_DIR;
  if (envDir && fs.existsSync(envDir)) return path.resolve(envDir);

  const backendRoot = path.resolve(__dirname, "..");   
  const monorepoApps = path.resolve(backendRoot, ".."); 
  const repoRoot = path.resolve(monorepoApps, "..");    

  const cands = [
    path.join(backendRoot, "configs"),
    path.join(monorepoApps, "configs"),
    path.join(repoRoot, "configs"),
  ];
  return findFirstExisting(...cands);
}

function cfgDir(): string | null {
  if (_cfgDirMemo !== undefined) return _cfgDirMemo;
  _cfgDirMemo = resolveCfgDir();

  if (process.env.FG_CONFIG_WATCH === "1") {
    const probeRoots = [
      path.resolve(__dirname, ".."),
      path.resolve(__dirname, "..", ".."),
      path.resolve(__dirname, "..", "..", ".."),
    ];

    setInterval(() => {
      const resolved = resolveCfgDir();
      if (resolved && _cfgDirMemo !== resolved) _cfgDirMemo = resolved;
    }, 3000).unref?.();
  }
  return _cfgDirMemo;
}

export function getConfigDir(): string | null {
  return cfgDir();
}

function safeRead<T>(file: string, fallback: T, validate?: (x: unknown) => x is T): T {
  try {
    const dir = cfgDir();
    if (!dir) return fallback;
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf8");
    const obj = JSON.parse(raw);
    if (validate) return validate(obj) ? obj : fallback;
    return (obj && typeof obj === "object") ? (obj as T) : fallback;
  } catch {
    return fallback;
  }
}


function isNumber(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v); }
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}
function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === "number" && Number.isFinite(x));
}
function isCalibration(v: unknown): v is Calibration {
  if (!v || typeof v !== "object") return false;
  const m = (v as any).method;
  if (m === "none") return true;
  if (m === "platt") return isNumber((v as any).a) && isNumber((v as any).b);
  if (m === "isotonic") return (v as any).bins === undefined || Number.isInteger((v as any).bins);
  return false;
}

export function loadThresholds(): Thresholds {
  const def: Thresholds = { allow: 0.6, block: 0.6, margin: 0.2, goalAllow: 0.75 };
  const raw = safeRead<Record<string, unknown>>("thresholds.json", {}, (x): x is Record<string, unknown> => !!x && typeof x === "object");

  const val: Thresholds = {
    allow:  isNumber(raw.allow)  ? (raw.allow as number)  : def.allow,
    block:  isNumber(raw.block)  ? (raw.block as number)  : def.block,
    margin: isNumber(raw.margin) ? (raw.margin as number) : def.margin,
    goalAllow: isNumber(raw.goalAllow) ? (raw.goalAllow as number) : def.goalAllow,
    T_allow: isNumber(raw.T_allow) ? (raw.T_allow as number) : undefined,
    T_block: isNumber(raw.T_block) ? (raw.T_block as number) : undefined,
  };
  return val;
}

export function loadPrototypes(): Prototypes {
  return safeRead<Prototypes>("prototypes.json", {}, (x: unknown): x is Prototypes => {
    if (!x || typeof x !== "object") return false;
    return Object.values(x as Record<string, unknown>).every((v) => typeof v === "string");
  });
}

export function loadWeights(): LinearWeights | null {
  const fallback: LinearWeights | null = null;
  const obj = safeRead<any>("weights.json", null);
  if (!obj) return fallback;

  const features = (obj as any).features as unknown;
  const w        = (obj as any).w as unknown;
  const b        = (obj as any).b as unknown;
  const rawCal   = (obj as any).calibration as unknown;

  if (!isStringArray(features) || !isNumberArray(w) || !isNumber(b)) return fallback;
  if (features.length !== w.length) return fallback;

  let cal: Calibration;
  if (rawCal === undefined) {
    cal = { method: "none" };
  } else if (isCalibration(rawCal)) {
    cal = rawCal;
  } else {
    return fallback;
  }

  return {
    features,
    w,
    b,
    calibration: cal, 
  };
}

