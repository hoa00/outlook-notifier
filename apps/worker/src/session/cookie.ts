export const SESSION_COOKIE = "sid";
export const CSRF_COOKIE = "csrf";

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
  path: string;
  maxAge?: number;
};

export function sessionCookieOptions(isProduction: boolean, maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function csrfCookieOptions(isProduction: boolean, maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: "Lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function serializeCookie(
  name: string,
  value: string,
  options: CookieOptions,
): string {
  const parts = [`${name}=${value}`, `Path=${options.path}`, `SameSite=${options.sameSite}`];
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

export function clearCookie(name: string, options: Omit<CookieOptions, "maxAge">): string {
  return serializeCookie(name, "", { ...options, maxAge: 0 });
}

export function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}
