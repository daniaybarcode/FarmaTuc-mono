// ──────────────────────────────────────────────────────────────
// FarmaTuc Web — Tipos de los contratos de la API (apps/api)
// Alineados EXACTO con lo que serializan los controllers.
// Los Decimal del backend ya llegan como number (Number() en el controller).
// ──────────────────────────────────────────────────────────────

export type Rol = "admin" | "farmaceutico" | "cajero" | "consulta" | "deposito";

export type MetodoPago =
  | "efectivo"
  | "debito"
  | "credito"
  | "transferencia"
  | "mixto";

export type EstadoVenta =
  | "pendiente"
  | "completada"
  | "cancelada"
  | "nota_credito";

export type EstadoLote =
  | "disponible"
  | "reservado"
  | "vencido"
  | "agotado"
  | "retirado";

export type TipoAlerta =
  | "stock_bajo"
  | "stock_critico"
  | "vencimiento_proximo_30"
  | "vencimiento_proximo_60"
  | "vencimiento_proximo_90"
  | "lote_vencido"
  | "medicamento_sin_stock";

export type Severidad = "info" | "warning" | "critical";

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

// ── Respuesta paginada genérica ──────────────────────────────

export interface ListaRespuesta<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ── Autenticación ────────────────────────────────────────────

export interface UsuarioLogin {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface LoginResult {
  token: string;
  usuario: UsuarioLogin;
}

// ── Medicamento ──────────────────────────────────────────────

export interface Medicamento {
  id: string;
  nombreComercial: string;
  principioActivo: string;
  concentracion: string;
  formaFarmaceutica: FormaFarmaceutica;
  laboratorio: string;
  codigoBarras: string | null;
  codigoANMAT: string | null;
  requiereReceta: boolean;
  precioUnitario: number;
  activo: boolean;
  categoriaTerapeutica: string;
  stockMinimo: number;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Lote ─────────────────────────────────────────────────────

export interface Lote {
  id: string;
  medicamentoId: string;
  numeroLote: string;
  fechaVencimiento: string;
  fechaFabricacion: string;
  stock: number;
  stockInicial: number;
  precioCompra: number;
  proveedor: string;
  numeroFactura: string | null;
  estado: EstadoLote;
  createdAt: string;
  updatedAt: string;
  medicamento: { nombreComercial: string; principioActivo: string };
}

// ── Obra social (resumida, para el cajero) ───────────────────

export interface ObraSocialResumida {
  id: string;
  nombre: string;
  sigla: string | null;
  porcentajeCobertura: number;
  tieneTope: boolean;
  topeMaximoPorMedicamento: number | null;
  requiereAfiliado: boolean;
  restriccionPorCategoria: boolean;
  categoriasCubiertas: string[];
}

// ── Paciente ─────────────────────────────────────────────────

export interface Paciente {
  id: string;
  nombre: string;
  documento: string;
  tipoDocumento: string;
  telefono: string | null;
  obraSocialId: string | null;
  numeroAfiliado: string | null;
  obraSocial: ObraSocialResumida | null;
  // Solo presentes en las respuestas POST/PUT (el listado no las expone).
  fechaNacimiento?: string | null;
  email?: string | null;
  observacionesClinicas?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ── Detalle de venta (serializado por ventas.controller) ─────

export interface DetalleVenta {
  id: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  descuentoObraSocial: number;
  montoCobertura: number;
  montoCopago: number;
  medicamento: { nombreComercial: string; principioActivo: string } | null;
  lote: { numeroLote: string; fechaVencimiento: string } | null;
}

// ── Venta ────────────────────────────────────────────────────

export interface Venta {
  id: string;
  numeroVenta: string;
  estado: EstadoVenta;
  subtotal: number;
  totalDescuentos: number;
  totalCobertura: number;
  totalCopago: number;
  totalFinal: number;
  metodoPago: MetodoPago;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
  pacienteId: string | null;
  obraSocialId: string | null;
  paciente: { nombre: string; documento: string } | null;
  obraSocial: { nombre: string } | null;
  detalles: DetalleVenta[];
}

export interface CreateVentaInput {
  items: Array<{ medicamentoId: string; cantidad: number }>;
  metodoPago: MetodoPago;
  pacienteId?: string | null;
  observaciones?: string | null;
}

// ── Alertas ──────────────────────────────────────────────────

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  severidad: Severidad;
  mensaje: string;
  acknowledged: boolean;
  createdAt: string;
  updatedAt: string;
  medicamento: {
    nombreComercial: string;
    principioActivo: string;
    stockMinimo: number;
  } | null;
  lote: { numeroLote: string; fechaVencimiento: string } | null;
}

export interface ResumenAlertas {
  porTipo: Record<string, number>;
  porSeveridad: Record<string, number>;
  sinAcknowledged: number;
}

// ── Obra social (detalle completo, para el backoffice) ────────

export interface ObraSocial {
  id: string;
  nombre: string;
  sigla: string | null;
  porcentajeCobertura: number;
  tieneTope: boolean;
  topeMaximoPorMedicamento: number | null;
  restriccionPorCategoria: boolean;
  categoriasCubiertas: string[];
  requiereAfiliado: boolean;
  activa: boolean;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Usuario (nunca expone passwordHash) ───────────────────────

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Licenciamiento offline ────────────────────────────────────

export interface LicenciaEstado {
  instalada: boolean;
  cliente: string | null;
  valida: boolean;
  diasRestantes: number | null;
  vencimiento: string | null;
  dentroDe30Dias: boolean;
  dentroDe15Dias: boolean;
  vencida: boolean;
  motivo: string | null;
}

export interface EmitirLicenciaInput {
  installationId: string;
  cliente: string;
  emitidaA?: string;
  fechaVencimiento: string;
}

export interface EmitirLicenciaResult {
  licencia: string;
}

// ── Inputs de creación/actualización del backoffice ───────────

export interface MedicamentoInput {
  nombreComercial: string;
  principioActivo: string;
  concentracion: string;
  formaFarmaceutica: FormaFarmaceutica;
  laboratorio: string;
  codigoBarras?: string | null;
  codigoANMAT?: string | null;
  requiereReceta?: boolean;
  precioUnitario: number;
  activo?: boolean;
  categoriaTerapeutica: string;
  stockMinimo?: number;
  observaciones?: string | null;
}

export interface LoteInput {
  medicamentoId: string;
  numeroLote: string;
  fechaVencimiento: string;
  fechaFabricacion: string;
  stock?: number;
  precioCompra: number;
  proveedor: string;
  numeroFactura?: string | null;
}

export interface LoteUpdateInput {
  numeroLote?: string;
  fechaVencimiento?: string;
  fechaFabricacion?: string;
  proveedor?: string;
  numeroFactura?: string | null;
  precioCompra?: number;
}

export interface ObraSocialInput {
  nombre: string;
  sigla?: string;
  porcentajeCobertura: number;
  tieneTope?: boolean;
  topeMaximoPorMedicamento?: number | null;
  restriccionPorCategoria?: boolean;
  categoriasCubiertas?: string[];
  requiereAfiliado?: boolean;
  activa?: boolean;
  observaciones?: string | null;
}

export interface PacienteInput {
  nombre: string;
  documento: string;
  tipoDocumento?: string;
  fechaNacimiento?: string;
  telefono?: string;
  email?: string;
  obraSocialId?: string | null;
  numeroAfiliado?: string | null;
  observacionesClinicas?: string | null;
}

export interface UsuarioUpdateInput {
  nombre?: string;
  rol?: Rol;
  activo?: boolean;
}

export interface NuevoUsuarioInput {
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}