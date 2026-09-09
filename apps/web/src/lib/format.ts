import type { EstadoVenta, MetodoPago, TipoAlerta } from "../types";

const MONEDA = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

export function formatearMoneda(valor: number): string {
  return MONEDA.format(valor);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "2026-09-08T14:30:00.000Z" → "08/09/2026" (zona local del navegador). */
export function formatearFecha(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "2026-09-08T14:30:00.000Z" → "08/09/2026 14:30". */
export function formatearFechaHora(iso: string): string {
  const d = new Date(iso);
  return `${formatearFecha(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const ETIQUETA_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  debito: "Débito",
  credito: "Crédito",
  transferencia: "Transferencia",
  mixto: "Mixto",
};

export function formatearMetodoPago(metodo: MetodoPago): string {
  return ETIQUETA_METODO_PAGO[metodo] ?? metodo;
}

export const ETIQUETA_ESTADO_VENTA: Record<EstadoVenta, string> = {
  pendiente: "Pendiente",
  completada: "Completada",
  cancelada: "Cancelada",
  nota_credito: "Nota de crédito",
};

export function formatearEstadoVenta(estado: EstadoVenta): string {
  return ETIQUETA_ESTADO_VENTA[estado] ?? estado;
}

export const ETIQUETA_TIPO_ALERTA: Record<TipoAlerta, string> = {
  stock_bajo: "Stock bajo",
  stock_critico: "Stock crítico",
  vencimiento_proximo_30: "Vence en ≤ 30 días",
  vencimiento_proximo_60: "Vence en ≤ 60 días",
  vencimiento_proximo_90: "Vence en ≤ 90 días",
  lote_vencido: "Lote vencido",
  medicamento_sin_stock: "Sin stock",
};

export function formatearTipoAlerta(tipo: TipoAlerta): string {
  return ETIQUETA_TIPO_ALERTA[tipo] ?? tipo;
}