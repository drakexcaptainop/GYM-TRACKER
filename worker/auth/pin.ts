// PBKDF2-SHA256 con WebCrypto (nativo, comparte codigo con scripts/set-pin.ts).

export const PIN_ITERATIONS = 10_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashPin(pin: string, saltHex: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(saltHex), iterations },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPin(
  pin: string,
  stored: { salt: string | null; hash: string | null; iterations: number | null },
): Promise<boolean> {
  if (!stored.salt || !stored.hash || !stored.iterations) return false;
  return safeEqual(await hashPin(pin, stored.salt, stored.iterations), stored.hash);
}
