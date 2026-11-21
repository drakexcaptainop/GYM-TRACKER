import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base =
  "w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-base text-ink placeholder:text-muted focus:border-cyan focus:outline-none";

function Label({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function TextField({ label, hint, ...rest }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label} hint={hint}>
      <input className={base} {...rest} />
    </Label>
  );
}

export function NumberField({ label, hint, ...rest }: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label} hint={hint}>
      <input className={base} type="number" inputMode="decimal" {...rest} />
    </Label>
  );
}

export function TextArea({ label, hint, ...rest }: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Label label={label} hint={hint}>
      <textarea className={`${base} min-h-24`} {...rest} />
    </Label>
  );
}

export function SelectField({ label, children, ...rest }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Label label={label}>
      <select className={base} {...rest}>
        {children}
      </select>
    </Label>
  );
}

/** "" -> null; texto numerico -> numero. */
export function toNumber(text: string): number | null {
  const value = text.trim();
  if (value === "") return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
