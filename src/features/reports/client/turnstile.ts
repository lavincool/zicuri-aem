/**
 * Cloudflare Turnstile in the browser. Each protected request gets a fresh token
 * (tokens are single-use), so reports sent later from the offline outbox verify too.
 * The widget stays invisible unless Cloudflare needs the person to interact.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TOKEN_TIMEOUT_MS = 30_000;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      appearance: "interaction-only";
      callback: (token: string) => void;
      "error-callback": () => void;
      "timeout-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let script: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  script ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const tag = document.createElement("script");
    tag.src = SCRIPT_URL;
    tag.async = true;
    tag.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("Turnstile did not load"));
    tag.onerror = () => reject(new Error("Turnstile did not load"));
    document.head.append(tag);
  }).catch((error: unknown) => {
    script = null;
    throw error;
  });
  return script;
}

/**
 * A fresh token for `action`, or null when Turnstile is not configured. Rejects when
 * Cloudflare can't be reached; callers treat that like a network error and retry.
 */
export async function turnstileToken(action: string): Promise<string | null> {
  if (!SITE_KEY) return null;
  const turnstile = await loadScript();
  const container = document.createElement("div");
  // Shown only if Cloudflare asks for a click; above sheets and the map.
  container.className =
    "fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-[100] -translate-x-1/2";
  document.body.append(container);
  const widget: { id: string | null } = { id: null };
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("Turnstile timed out")),
        TOKEN_TIMEOUT_MS,
      );
      const fail = () => {
        window.clearTimeout(timer);
        reject(new Error("Turnstile failed"));
      };
      widget.id = turnstile.render(container, {
        sitekey: SITE_KEY,
        action,
        appearance: "interaction-only",
        callback: (token) => {
          window.clearTimeout(timer);
          resolve(token);
        },
        "error-callback": fail,
        "timeout-callback": fail,
      });
    });
  } finally {
    if (widget.id) turnstile.remove(widget.id);
    container.remove();
  }
}
