import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
} from "react";

// ── Button ────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "success" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 disabled:bg-brand-300",
  secondary:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 disabled:text-slate-300",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className = "",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <LoadingSpinner size="sm" light={variant === "primary" || variant === "danger" || variant === "success"} />}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({
  label,
  hint,
  className = "",
  id,
  ref,
  ...rest
}: InputProps) {
  const inputId = id ?? (label ? `input-${label}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-2 focus:outline-brand-600 disabled:bg-slate-100 disabled:text-slate-400 ${className}`}
        {...rest}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────

interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Card({
  title,
  actions,
  children,
  className = "",
  bodyClassName = "",
}: CardProps) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

// ── Badge ─────────────────────────────────────────────────────

type BadgeTone = "gray" | "green" | "red" | "amber" | "blue" | "teal";

const BADGE_TONES: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-600",
  green: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-sky-100 text-sky-700",
  teal: "bg-teal-100 text-teal-700",
};

export function Badge({
  tone = "gray",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// ── LoadingSpinner ────────────────────────────────────────────

export function LoadingSpinner({
  size = "md",
  light = false,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  light?: boolean;
  className?: string;
}) {
  const dims = {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-2",
    lg: "h-10 w-10 border-[3px]",
  }[size];
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={`inline-block animate-spin rounded-full border-t-transparent ${
        light ? "border-white/70" : "border-brand-600"
      } ${dims} ${className}`}
    />
  );
}

// ── ErrorBanner ───────────────────────────────────────────────

export function ErrorBanner({
  message,
  detalles = [],
  className = "",
}: {
  message: string;
  detalles?: string[];
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 ${className}`}
    >
      <p className="font-medium">{message}</p>
      {detalles.length > 0 && (
        <ul className="mt-1 list-inside list-disc text-xs text-red-700">
          {detalles.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────

export function EmptyState({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 ${className}`}
    >
      {children}
    </div>
  );
}