// apps/backend/scripts/prune_logs.ts
// Delete day-rotated JSONL files older than N days (default 7).
import fs from "fs";
import path from "path";

const LOG_DIR = process.env.FG_LOG_DIR || path.resolve(process.cwd(), "logs");
const RETAIN_DAYS = Number(process.argv[2] || process.env.FG_LOG_RETENTION_DAYS || 7);

function cutoffDate() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - RETAIN_DAYS);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

(async () => {
  if (!fs.existsSync(LOG_DIR)) process.exit(0);
  const files = fs.readdirSync(LOG_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f));
  const cut = cutoffDate();

  let deleted = 0;
  for (const f of files) {
    const full = path.join(LOG_DIR, f);
    const day = new Date(f.slice(0, 10) + "T00:00:00Z");
    if (day < cut) {
      try { fs.unlinkSync(full); deleted++; } catch {}
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Pruned ${deleted} files (retain ${RETAIN_DAYS} days)`);
})();
