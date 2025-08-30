export function planChecks(durationMs: number, n: number): number[] {
  const slots = Array.from({ length: n }, (_, i) => (i + 0.5) * durationMs / n)
  return slots
    .map(t => t + (Math.random() - 0.5) * (durationMs / n) * 0.4) // }20% jitter
    .map(t => Math.max(0, Math.min(durationMs - 1000, t)))
    .sort((a, b) => a - b)
}

export function watchNavChanges(cb: () => void, opts?: { minIntervalMs?: number; pollMs?: number }) {
  const minInterval = opts?.minIntervalMs ?? 15_000
  const pollMs = opts?.pollMs ?? 5_000
  let lastFire = 0
  let lastURL = location.href
  let lastTitle = document.title

  const timer = window.setInterval(() => {
    const now = Date.now()
    const changed = (location.href !== lastURL) || (document.title !== lastTitle)
    if (changed && (now - lastFire >= minInterval)) {
      lastURL = location.href
      lastTitle = document.title
      lastFire = now
      try { cb() } catch (e) { console.warn("[FocusGuard] nav cb error", e) }
    }
  }, pollMs)

  return () => window.clearInterval(timer)
}
