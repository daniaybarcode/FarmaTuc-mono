// ──────────────────────────────────────────────────────────────
// FarmaTuc — Tipos del dominio farmacéutico
// ──────────────────────────────────────────────────────────────
// Este paquete define TODOS los tipos compartidos entre API y Web.
// Las interfaces aquí son el CONTRATO de datos del sistema.
// ──────────────────────────────────────────────────────────────

// ── Utilidades base ──────────────────────────────────────────

/** ID de Prisma (UUID v4) */
export type ID = string;

/** Marca temporal ISO-8601 */
export type ISOTimestamp = string;

/**Base para todas las entidades auditables. Todo en el sistema tiene esto. */
export interface AuditableEntity {
  id: ID;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

// ── Medicamento ──────────────────────────────────────────────

/**
 * Forma farmacéutica del medicamento.
 * Representa cómo se presenta el producto (comprimido, jarabe, etc.)
 */
export type FormaFarmaceutica =
  | "comprimido"
  | "capsula"
  | "jarabe"
  | "suspension_oral"
  | "crema"
  | "pomada"
  | "gel"
  | "supositorio"
  | "ampolla"
  | "spray"
  | "colirio"
  | "gotas"
  | "polvo"
  | "inhador"
  | "parche"
  | "otro";

/**
 * Un medicamento es el PRODUCTO genérico (no el lote).
 * Contiene la información permanente: nombre, principio activo,
 * presentación, código de barras, y el precio de referencia.
 *
 * Diseño: Separamos "Medicamento" de "Lote" porque un mismo
 * medicamento puede tener N lotes con distintos vencimientos
 * y stock独立. Esta separación es la base de la trazabilidad FIFO.
 */
export interface Medicamento extends AuditableEntity {
  /** Nombre comercial (ej: "Ibuprofeno 600mg Genfar") */
  nombreComercial: string;

  /** Monodroga / principio activo (ej: "Ibuprofeno") — BUSQUEDA PRINCIPAL */
  principioActivo: string;

  /** Concentración (ej: "600mg", "125ml", "2%") */
  concentracion: string;

  /** Forma farmacéutica */
  formaFarmaceutica: FormaFarmaceutica;

  /** Laboratorio / marca */
  laboratorio: string;

  /** Código de barras EAN-13 o EAN-8 */
  codigoBarras: string | null;

  /** Código de medicamento ANMAT (si aplica) */
  codigoANMAT: string | null;

  /** Requiere receta blanca / amarilla */
  requiereReceta: boolean;

  /** Precio unitario de referencia (pesos) */
  precioUnitario: number;

  /** True si el medicamento está habilitado para venta */
  activo: boolean;

  /** Categoría terapéutica (ej: "Analgesicos", "Antibioticos") */
  categoriaTerapeutica: string;

  /** Stock MÍNIMO antes de emitir alerta de reposición */
  stockMinimo: number;

  /** Observaciones libres */
  observaciones: string | null;

  /** Lotes asociados a este medicamento (relación 1:N) */
  lotes?: Lote[];
}

// ── Lote ─────────────────────────────────────────────────────

/**
 * Un LOTE representa un envío/ingreso específico de un medicamento.
 *
 * RELACIÓN CRÍTICA: Un Medicamento tiene MUCHOS Lotes.
 * Cada lote tiene su propio:
 *   - número de lote (del proveedor/fabricante)
 *   - fecha de vencimiento
 *   - stock independiente
 *   - precio de compra
 *
 * FIFO: Cuando se registra una venta, el sistema descuenta stock
 * del lote con la fecha de vencimiento MÁS PRÓXIMA primero.
 * Esto garantiza que se vendan primero los productos que vencen antes.
 */
export interface Lote extends AuditableEntity {
  /** FK → Medicamento al que pertenece este lote */
  medicamentoId: ID;

  /** Número de lote del fabricante/proveedor (ej: "LOT-2024-0891") */
  numeroLote: string;

  /** Fecha de vencimiento — EL CAMPO MÁS IMPORTANTE PARA FIFO */
  fechaVencimiento: ISOTimestamp;

  /** Fecha de fabricación */
  fechaFabricacion: ISOTimestamp;

  /** Stock ACTUAL de este lote específico */
  stock: number;

  /** Stock original con el que ingresó (para auditoría) */
  stockInicial: number;

  /** Precio de compra al proveedor (costo) */
  precioCompra: number;

  /** Proveedor que suministró este lote */
  proveedor: string;

  /** Número de factura del proveedor */
  numeroFactura: string | null;

  /** Estado del lote */
  estado: EstadoLote;

  /** Medicamento padre (relación inversa) */
  medicamento?: Medicamento;
}

/**
 * Estados posibles de un lote.
 *
 * - "disponible": se puede vender (stock > 0 y no vencido)
 * - "reservado": apartado para un pedido pendiente
 * - "vencido": pasó la fecha de vencimiento → NO se puede vender
 * - "agotado": stock = 0
 * - "retirado": removido del sistema por decisión administrativa
 */
export type EstadoLote =
  | "disponible"
  | "reservado"
  | "vencido"
  | "agotado"
  | "retirado";

// ── Obra Social / Cobertura Médica ───────────────────────────

/**
 * Obra Social o Prepaga que cubre parte del costo de medicamentos.
 *
 * Cada OS tiene un porcentaje de cobertura sobre el precio de venta.
 * El paciente paga la diferencia (copago).
 *
 * Ejemplo: OS "OSPE" con 40% de cobertura:
 *   - Medicamento: $1000
 *   - OS paga: $400
 *   - Paciente paga: $600
 */
export interface ObraSocial extends AuditableEntity {
  /** Nombre oficial (ej: "OSPE", "OSPRERA", "Swiss Medical") */
  nombre: string;

  /** Sigla / abreviatura */
  sigla: string | null;

  /** Porcentaje de cobertura (0.00 a 100.00) */
  porcentajeCobertura: number;

  /** Si true, aplica tope máximo por medicamento */
  tieneTope: boolean;

  /** Tope máximo por medicamento (si tieneTope es true) */
  topeMaximoPorMedicamento: number | null;

  /** Si true, solo cubre medicamentos de ciertas categorías */
  restriccionPorCategoria: boolean;

  /** Categorías cubiertas (vacío = todas) */
  categoriasCubiertas: string[];

  /** Convenio / número de afiliado requerido */
  requiereAfiliado: boolean;

  /** Estado de la obra social */
  activa: boolean;

  /** Observaciones */
  observaciones: string | null;
}

// ── Paciente ─────────────────────────────────────────────────

/**
 * Paciente / cliente que compra en la farmacia.
 * Puede tener obra social para cobertura parcial.
 */
export interface Paciente extends AuditableEntity {
  /** Nombre completo */
  nombre: string;

  /** DNI / documento de identidad (único) */
  documento: string;

  /** Tipo de documento */
  tipoDocumento: "dni" | "cedula" | "pasaporte" | "libreta_civica";

  /** Fecha de nacimiento */
  fechaNacimiento: ISOTimestamp | null;

  /** Teléfono */
  telefono: string | null;

  /** Email */
  email: string | null;

  /** FK → Obra Social (null si no tiene) */
  obraSocialId: ID | null;

  /** Número de afiliado a la obra social */
  numeroAfiliado: string | null;

  /** Obra social del paciente (join) */
  obraSocial?: ObraSocial;

  /** Alergias o observaciones clínicas relevantes */
  observacionesClinicas: string | null;
}

// ── Usuario del sistema ──────────────────────────────────────

/**
 * Usuarios que operan el sistema.
 * Farmacéutico, cajero, administrador, etc.
 */
export type RolUsuario =
  | "admin"
  | "farmaceutico"
  | "cajero"
  | "deposito"
  | "consulta";

export interface Usuario extends AuditableEntity {
  nombre: string;
  email: string;
  /** Hash bcrypt — nunca se expone en API pública */
  passwordHash: string;
  rol: RolUsuario;
  activo: boolean;
}

// ── Detalle de Venta ─────────────────────────────────────────

/**
 * Una línea de la venta — representa la venta de 1 item específico.
 *
 * TRAZABILIDAD: Cada detalle referencia el LOTE específico del
 * cual se descontó stock. Esto permite:
 *   - Saber de qué lote vino cada medicamento vendido
 *   - Auditoría completa de movimientos de stock
 *   - Rastreo en caso de recall de un lote específico
 *
 * COBERTURA: Cada línea calcula su propio descuento por OS,
 * porque diferentes medicamentos pueden tener diferentes
 * porcentajes de cobertura según la categoría.
 */
export interface DetalleVenta extends AuditableEntity {
  /** FK → Venta padre */
  ventaId: ID;

  /** FK → Medicamento vendido */
  medicamentoId: ID;

  /** FK → Lote específico del que se descontó stock (FIFO) */
  loteId: ID;

  /** Cantidad vendida de este ítem */
  cantidad: number;

  /** Precio unitario al momento de la venta (snapshot) */
  precioUnitario: number;

  /** Subtotal = cantidad × precioUnitario */
  subtotal: number;

  /** Descuento aplicado por Obra Social (en pesos) */
  descuentoObraSocial: number;

  /** Monto que paga la Obra Social */
  montoCobertura: number;

  /** Monto que paga el paciente (copago) */
  montoCopago: number;

  /** Referencias (join) */
  medicamento?: Medicamento;
  lote?: Lote;
}

// ── Venta ────────────────────────────────────────────────────

/**
 * Venta consolidada — el comprobante de una transacción en la farmacia.
 *
 * FLUJO FIFO al registrar:
 *   1. Seleccionar medicamento → cantidad solicitada
 *   2. Buscar lotes disponibles ordenados por fechaVencimiento ASC
 *   3. Descontar stock del lote más viejo primero
 *   4. Si el lote no alcanza, continuar con el siguiente
 *   5. Crear un DetalleVenta por cada lote utilizado
 *   6. Crear la Venta consolidada
 *
 * IMPERmutabilidad: Una venta creada NUNCA se modifica.
 * Si hay un error, se genera un "cargo negativo" (NC) como
 * venta nueva con cantidades negativas.
 */
export type EstadoVenta =
  | "pendiente"
  | "completada"
  | "cancelada"
  | "nota_credito";

export interface Venta extends AuditableEntity {
  /** Número secuencial de venta (legible, ej: "VTA-2024-0001234") */
  numeroVenta: string;

  /** FK → Paciente (null si es venta "mostrador" sin identificar) */
  pacienteId: ID | null;

  /** FK → Obra Social del paciente (null si no aplica cobertura) */
  obraSocialId: ID | null;

  /** FK → Usuario que registró la venta */
  usuarioId: ID;

  /** Estado de la venta */
  estado: EstadoVenta;

  /** Subtotal bruto (suma de todos los detalles) */
  subtotal: number;

  /** Total de descuentos por obra social */
  totalDescuentos: number;

  /** Total que cubre la obra social */
  totalCobertura: number;

  /** Total que paga el paciente (subtotal - descuentos) */
  totalCopago: number;

  /** Monto final cobrado */
  totalFinal: number;

  /** Método de pago (efectivo, tarjeta, transferencia, mixto) */
  metodoPago: MetodoPago;

  /** Observaciones */
  observaciones: string | null;

  /** Detalles de la venta (join) */
  detalles?: DetalleVenta[];

  /** Referencias (join) */
  paciente?: Paciente;
  obraSocial?: ObraSocial;
  usuario?: Usuario;
}

/**
 * Método de pago de la venta.
 */
export type MetodoPago =
  | "efectivo"
  | "debito"
  | "credito"
  | "transferencia"
  | "mixto";

// ── Alertas del sistema ──────────────────────────────────────

/**
 * Tipo de alerta que el sistema puede generar.
 * Usado en el dashboard del backoffice.
 */
export type TipoAlerta =
  | "stock_bajo"
  | "stock_critico"
  | "vencimiento_proximo_30"
  | "vencimiento_proximo_60"
  | "vencimiento_proximo_90"
  | "lote_vencido"
  | "medicamento_sin_stock";

/**
 * Alerta generada por el sistema para el backoffice.
 */
export interface AlertaInventario extends AuditableEntity {
  /** Tipo de alerta */
  tipo: TipoAlerta;

  /** FK → Medicamento relacionado */
  medicamentoId: ID;

  /** FK → Lote relacionado (puede ser null para stock_bajo global) */
  loteId: ID | null;

  /** Mensaje descriptivo de la alerta */
  mensaje: string;

  /** Nivel de severidad */
  severidad: "info" | "warning" | "critical";

  /** Si true, la alerta fue revisada/acknowledged por un admin */
  acknowledged: boolean;

  /** FK → Usuario que acknowledge (null si aún no se revisó) */
  acknowledgedById: ID | null;

  /** Medicamento referenciado */
  medicamento?: Medicamento;
}

// ── Re-export de tipos utilitarios ───────────────────────────

export type {
  ID as Identificador,
  ISOTimestamp as MarcaTemporal,
};
