import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "amber";

const styles: Record<Variant, string> = {
  primary: "bg-brand text-on-accent font-semibold shadow-lg shadow-primary/20",
  secondary: "bg-surface-2 text-ink border border-line",
  ghost: "bg-transparent text-muted",
  amber: "bg-amber text-on-accent font-semibold",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  block?: boolean;
  size?: "md" | "lg";
}

export function Button({ variant = "primary", block, size = "md", className = "", type = "button", ...rest }: Props) {
  const height = size === "lg" ? "min-h-16 text-lg" : "min-h-12 text-base";
  return (
    <button
      type={type}
      className={`${styles[variant]} ${height} ${block ? "w-full" : ""} rounded-2xl px-5 transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${className}`}
      {...rest}
    />
  );
}
