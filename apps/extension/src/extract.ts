export async function waitStableDOM(timeout = 5000): Promise<void> {
  return new Promise((resolve) => {
    let settleTimer: number | undefined;

    const armSettle = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        obs.disconnect();
        resolve();
      }, 300);
    };

    const obs = new MutationObserver(() => {
      armSettle(); 
    });

    obs.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    armSettle();

    window.setTimeout(() => {
      if (settleTimer) clearTimeout(settleTimer);
      obs.disconnect();
      resolve();
    }, timeout);
  });
}


function getMeta(name: string): string {
  return (
    document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ||
    document.querySelector(`meta[property="${name}"]`)?.getAttribute("content") ||
    ""
  )
}

function getJsonLd(): string {
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
  const parts: string[] = []
  for (const s of scripts) {
    const t = s.textContent || ""
    if (t) parts.push(t.slice(0, 4000))
  }
  return parts.join("\n")
}

export async function extractMinimum() {
  await waitStableDOM()

  const title = document.title || getMeta("og:title") || getMeta("twitter:title")
  const description = getMeta("description") || getMeta("og:description") || getMeta("twitter:description")
  const jsonld = getJsonLd()
  const main = document.querySelector("article, main")?.textContent?.trim() ?? ""
  const snippet = main.slice(0, 600)

  return {
    url: location.href,
    domain: location.hostname,
    title: title || undefined,
    description: description || undefined,
    snippet: snippet || undefined,
    jsonld: jsonld || undefined
  }
}
