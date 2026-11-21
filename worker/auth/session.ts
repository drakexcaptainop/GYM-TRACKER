// Cookie de sesion firmada con HMAC, sin estado: autenticar no lee D1.

export const SESSION_COOKIE = "gt_session";
export const SESSION_SECONDS = 180 * 24 * 60 * 60;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function hmacKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signSession(profileId: number, secret: string, nowSeconds: number): Promise<string> {
  const payload = `${profileId}:${nowSeconds + SESSION_SECONDS}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), new TextEncoder().encode(payload));
  return `${b64url(new TextEncoder().encode(payload))}.${b64url(new Uint8Array(sig))}`;
}

/** Devuelve el id del perfil si la cookie es valida y no vencio; si no, null. */
export async function readSession(token: string | undefined, secret: string, nowSeconds: number): Promise<number | null> {
  if (!token) return null;
  const [payloadPart, sigPart] = token.split(".");
  if (!payloadPart || !sigPart) return null;
  const payloadBytes = fromB64url(payloadPart);
  const sig = fromB64url(sigPart);
  if (!payloadBytes || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), sig, payloadBytes);
  if (!ok) return null;
  const [id, exp] = new TextDecoder().decode(payloadBytes).split(":").map(Number);
  if (id === undefined || exp === undefined || !Number.isInteger(id) || !Number.isInteger(exp) || exp <= nowSeconds) return null;
  return id;
}
