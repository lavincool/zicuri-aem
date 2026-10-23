/** localStorage can be unavailable (private mode, blocked site data); never let it break the app. */
export function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeFlag(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Without storage the intro simply shows again next time.
  }
}

export const ONBOARDING_KEY = "cauce:onboarding";
export const VISITS_KEY = "cauce:visits";
export const INSTALL_HINT_KEY = "cauce:install-hint";
