import { type ReactNode, type SelectHTMLAttributes } from "react";
import { Badge, Button } from "../../components/ui";
import type { EstadoLote, FormaFarmaceutica, Rol } from "../../types";

// ── Modal ─────────────────────────────────────────────────────

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`my-4 w-full ${
          wide ? "max-w-3xl" : "max-w-xl"
        } rounded-2xl bg-white shadow-2xl`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar">
            ✕
          </Button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export function Select({
  label,
  hint,
  options,
  id,
  className = "",
  ...rest
}: SelectProps) {
  const selectId = id ?? (label ? `select-${label}` : undefined);
  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500"
        >
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-brand-600 focus:outline-2 focus:outline-brand-600 disabled:bg-slate-100 disabled:text-slate-400 ${className}`}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Checkbox ──────────────────────────────────────────────────

export function Checkbox({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 transition-colors hover:bg-slate-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-brand-600"
      />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

// ── Paginación ────────────────────────────────────────────────

export function Paginacion({
  total,
  limit,
  offset,
  onChange,
}: {
  total: number;
  limit: number;
  offset: number;
  onChange: (nuevoOffset: number) => void;
}) {
  if (total <= limit) return null;
  const totalPaginas = Math.max(1, Math.ceil(total / limit));
  const paginaActual = Math.floor(offset / limit) + 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        {total} registro{total === 1 ? "" : "s"} · Página {paginaActual} de{" "}
        {totalPaginas}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(offset - limit)}
        >
          ← Anterior
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={offset + limit >= total}
          onClick={() => onChange(offset + limit)}
        >
          Siguiente →
        </Button>
      </div>
    </div>
  );
}

// ── Forma farmacéutica ────────────────────────────────────────

export const FORMAS_FARMACEUTICAS: Array<{
  value: FormaFarmaceutica;
  label: string;
}> = [
  { value: "comprimido", label: "Comprimido" },
  { value: "capsula", label: "Cápsula" },
  { value: "jarabe", label: "Jarabe" },
  { value: "suspension_oral", label: "Suspensión oral" },
  { value: "crema", label: "Crema" },
  { value: "pomada", label: "Pomada" },
  { value: "gel", label: "Gel" },
  { value: "supositorio", label: "Supositorio" },
  { value: "ampolla", label: "Ampolla" },
  { value: "spray", label: "Spray" },
  { value: "colirio", label: "Colirio" },
  { value: "gotas", label: "Gotas" },
  { value: "polvo", label: "Polvo" },
  { value: "inhador", label: "Inhalador" },
  { value: "parche", label: "Parche" },
  { value: "otro", label: "Otro" },
];

export function formatearFormaFarmaceutica(valor: FormaFarmaceutica): string {
  return FORMAS_FARMACEUTICAS.find((f) => f.value === valor)?.label ?? valor;
}

// ── Roles ─────────────────────────────────────────────────────

export const OPCIONES_ROL: Array<{ value: Rol; label: string }> = [
  { value: "admin", label: "Administrador" },
  { value: "farmaceutico", label: "Farmacéutico" },
  { value: "cajero", label: "Cajero" },
  { value: "deposito", label: "Depósito" },
  { value: "consulta", label: "Consulta" },
];

const TONO_ROL: Record<Rol, "teal" | "green" | "blue" | "amber" | "gray"> = {
  admin: "teal",
  farmaceutico: "green",
  cajero: "blue",
  deposito: "amber",
  consulta: "gray",
};

export function RolBadge({ rol }: { rol: Rol }) {
  return (
    <Badge tone={TONO_ROL[rol]}>
      {OPCIONES_ROL.find((r) => r.value === rol)?.label ?? rol}
    </Badge>
  );
}

// ── Tipo de documento ─────────────────────────────────────────

export const OPCIONES_TIPO_DOCUMENTO: Array<{ value: string; label: string }> = [
  { value: "dni", label: "DNI" },
  { value: "cedula", label: "Cédula" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "libreta_civica", label: "Libreta cívica" },
];

export function formatearTipoDocumento(tipo: string): string {
  return OPCIONES_TIPO_DOCUMENTO.find((t) => t.value === tipo)?.label ?? tipo;
}

// ── Estado de lote ────────────────────────────────────────────

export const ETIQUETA_ESTADO_LOTE: Record<EstadoLote, string> = {
  disponible: "Disponible",
  reservado: "Reservado",
  vencido: "Vencido",
  agotado: "Agotado",
  retirado: "Retirado",
};

const TONO_ESTADO_LOTE: Record<
  EstadoLote,
  "green" | "blue" | "red" | "amber" | "gray"
> = {
  disponible: "green",
  reservado: "blue",
  vencido: "red",
  agotado: "amber",
  retirado: "gray",
};

export function EstadoLoteBadge({ estado }: { estado: EstadoLote }) {
  return <Badge tone={TONO_ESTADO_LOTE[estado]}>{ETIQUETA_ESTADO_LOTE[estado]}</Badge>;
}

// ── Fechas ────────────────────────────────────────────────────

/** Fecha de hoy local en "YYYY-MM-DD" para inputs type="date". */
export function hoyLocal(): string {
  const ahora = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(
    ahora.getDate(),
  )}`;
}

/** "2026-09-10T03:00:00.000Z" → "2026-09-10" para prefill de inputs date. */
export function aFechaInput(iso: string): string {
  return iso.slice(0, 10);
}