// Frases de ánimo predeterminadas. El Worker solo acepta estas claves: no hay texto libre.
export const PHRASES = [
  { key: "tu-puedes", text: "¡Tú puedes! 💪" },
  { key: "vamos", text: "¡Vamos, no te rindas!" },
  { key: "contigo", text: "¡Estoy contigo! 💙" },
  { key: "uno-mas", text: "¡Un entrenamiento más!" },
  { key: "orgullo", text: "¡Qué orgullo ver tu progreso!" },
] as const;

export type PhraseKey = (typeof PHRASES)[number]["key"];

export const PHRASE_KEYS = PHRASES.map((p) => p.key) as [PhraseKey, ...PhraseKey[]];

export function phraseText(key: string): string | null {
  return PHRASES.find((p) => p.key === key)?.text ?? null;
}
