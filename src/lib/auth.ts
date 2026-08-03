/**
 * Simpler Passwort-Login, per Env-Variable APP_PASSWORD geschaltet.
 * Nur Web-APIs verwenden — läuft auch in der Edge-Runtime (Middleware).
 */

export const AUTH_COOKIE = "scrumi_auth";

/** Ein Jahr — Nutzer bleiben dauerhaft angemeldet. */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Leerer String = Login deaktiviert. */
export function configuredPassword(): string {
  return (process.env.APP_PASSWORD ?? "").trim();
}

/** SHA-256-Hex-Hash — Cookie-Wert, damit das Passwort selbst nie im Cookie liegt. */
export async function passwordHash(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
