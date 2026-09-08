import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import { startOfToday } from "../schemas/lote.schema.js";
import type { CreateVentaInput, VentaItemInput } from "../schemas/venta.schema.js";

/**
 * Placeholder de usuario mientras no existe el sistema de autenticación.
 * Una vez exista auth JWT, este valor vendrá del token del cajero logueado.
 */
const USUARIO_FALLBACK = "00000000-0000-0000-0000-000000000000";

const DETALLE_BASICO = {
  include: {
    medicamento: {
      select: {
        nombreComercial: true,
        principioActivo: true,
        categoriaTerapeutica: true,
      },
    },
    lote: {
      select: { numeroLote: true, fechaVencimiento: true },
    },
  },
} as const;

const VENTA_COMPLETA = {
  include: {
    detalles: DETALLE_BASICO,
    paciente: {
      select: { nombre: true, documento: true },
    },
    usuario: {
      select: { nombre: true, email: true },
    },
  },
} as const;

type Tx = Prisma.TransactionClient;

interface DetalleConstruido {
  medicamentoId: string;
  loteId: string;
  cantidad: number;
  precioUnitario: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  categoriaTerapeutica: string;
}

interface ConsumoLote {
  loteId: string;
  cantidad: number;
  nuevoStock: number;
}

/**
 * Resuelve las cantidades a descontar de cada lote siguiendo FIFO estricto.
 * Orden: por fechaVencimiento ASC (el que vence primero se vende primero).
 * Retorna una entrada por lote efectivamente usado (los cruces generan
 * múltiples entradas apuntando al mismo lote se consolidan).
 */
function planificarConsumo(
  lotes: Array<{ id: string; stock: number }>,
  cantidad: number,
): Array<ConsumoLote> {
  const resultado: ConsumoLote[] = [];
  let restante = cantidad;

  for (const lote of lotes) {
    if (restante === 0) break;
    const aTomar = Math.min(restante, lote.stock);
    resultado.push({
      loteId: lote.id,
      cantidad: aTomar,
      nuevoStock: lote.stock - aTomar,
    });
    restante -= aTomar;
  }

  return resultado;
}

async function construirDetallesPorItem(
  tx: Tx,
  item: VentaItemInput,
): Promise<{ detalles: DetalleConstruido[]; subtotalItem: Prisma.Decimal }> {
  const medicamento = await tx.medicamento.findUnique({
    where: { id: item.medicamentoId },
    select: {
      id: true,
      precioUnitario: true,
      nombreComercial: true,
      categoriaTerapeutica: true,
    },
  });

  if (!medicamento) {
    throw new AppError(404, "Medicamento no encontrado");
  }

  // Un lote se considera vencido a partir de su fecha de vencimiento
  // (misma regla "hoy o futuro" que define el estado derivado del lote).
  const limiteVenta = startOfToday();
  const lotes = await tx.lote.findMany({
    where: {
      medicamentoId: item.medicamentoId,
      estado: "disponible",
      stock: { gt: 0 },
      fechaVencimiento: { gte: limiteVenta },
    },
    orderBy: { fechaVencimiento: "asc" },
    select: { id: true, stock: true },
  });

  const stockDisponible = lotes.reduce((acc, l) => acc + l.stock, 0);

  if (stockDisponible < item.cantidad) {
    throw new AppError(
      409,
      `Stock insuficiente para ${medicamento.nombreComercial}. Disponible: ${stockDisponible}, solicitado: ${item.cantidad}`,
    );
  }

  const consumo = planificarConsumo(lotes, item.cantidad);

  const detalles: DetalleConstruido[] = [];

  for (const paso of consumo) {
    // Race-safe: solo descuenta si el lote aún tiene el stock necesario.
    const resultado = await tx.lote.updateMany({
      where: {
        id: paso.loteId,
        stock: { gte: paso.cantidad },
      },
      data: { stock: { decrement: paso.cantidad } },
    });

    // Si count es 0, otro cajero consumió stock entre la lectura y acá:
    // abortar toda la transacción para nunca quedar con stock negativo.
    if (resultado.count === 0) {
      throw new AppError(409, "Conflicto de stock concurrente, reintente la venta");
    }

    if (paso.nuevoStock === 0) {
      await tx.lote.update({
        where: { id: paso.loteId },
        data: { estado: "agotado" },
      });
    }

    const precioUnitario = medicamento.precioUnitario;
    const subtotal = precioUnitario.mul(paso.cantidad);

    detalles.push({
      medicamentoId: item.medicamentoId,
      loteId: paso.loteId,
      cantidad: paso.cantidad,
      precioUnitario,
      subtotal,
      categoriaTerapeutica: medicamento.categoriaTerapeutica,
    });
  }

  const subtotalItem = detalles.reduce(
    (acc, d) => acc.add(d.subtotal),
    new Prisma.Decimal(0),
  );

  return { detalles, subtotalItem };
}

function generarNumeroVenta(count: number): string {
  const año = new Date().getFullYear();
  const secuencial = String(count + 1).padStart(6, "0");
  return `VTA-${año}-${secuencial}`;
}

/**
 * Registra una venta aplicando la lógica FIFO de forma atómica.
 *
 * Toda la operación (leer medicamento + lotes, descontar stock, crear
 * venta y detalles) corre dentro de una única transacción interactiva.
 * Si cualquier paso falla (stock insuficiente, conflicto de carrera,
 * número de venta duplicado) Prisma hace rollback de TODO.
 */
export type VentaRegistrada = Prisma.VentaGetPayload<{
  include: typeof VENTA_COMPLETA.include;
}>;

export async function registrarVenta(input: CreateVentaInput): Promise<VentaRegistrada> {
  return prisma.$transaction(async (tx) => {
    const usuarioId = input.usuarioId ?? USUARIO_FALLBACK;

    // ── Resolución de paciente ──────────────────────────────────
    let pacienteObraSocialId: string | null = null;
    let pacienteNumeroAfiliado: string | null = null;

    if (input.pacienteId) {
      const paciente = await tx.paciente.findUnique({
        where: { id: input.pacienteId },
        select: { id: true, obraSocialId: true, numeroAfiliado: true },
      });
      if (!paciente) {
        throw new AppError(404, "Paciente no encontrado");
      }
      pacienteObraSocialId = paciente.obraSocialId;
      pacienteNumeroAfiliado = paciente.numeroAfiliado;
    }

    // ── Resolución de obra social ───────────────────────────────
    let obraSocial: {
      id: string;
      activa: boolean;
      porcentajeCobertura: Prisma.Decimal;
      tieneTope: boolean;
      topeMaximoPorMedicamento: Prisma.Decimal | null;
      restriccionPorCategoria: boolean;
      categoriasCubiertas: string[];
      requiereAfiliado: boolean;
    } | null = null;

    const obraSocialId = input.obraSocialId ?? pacienteObraSocialId;

    if (obraSocialId) {
      const found = await tx.obraSocial.findUnique({
        where: { id: obraSocialId },
      });

      if (!found) {
        throw new AppError(404, "Obra social no encontrada");
      }

      if (!found.activa) {
        // Obra social inactiva → sin cobertura (no es error)
        obraSocial = null;
      } else {
        obraSocial = found;
      }
    }

    // Gate de afiliado: si requiereAfiliado y el paciente no tiene número
    // de afiliado → sin cobertura. (El número de afiliado solo puede venir
    // del paciente; un override por body sin paciente nunca trae afiliado.)
    if (obraSocial?.requiereAfiliado && !pacienteNumeroAfiliado) {
      obraSocial = null;
    }

    // ── Construcción de detalles (FIFO) ─────────────────────────
    let subtotal = new Prisma.Decimal(0);
    const detalles: DetalleConstruido[] = [];

    for (const item of input.items) {
      const { detalles: detallesItem, subtotalItem } =
        await construirDetallesPorItem(tx, item);
      detalles.push(...detallesItem);
      subtotal = subtotal.add(subtotalItem);
    }

    // ── Cálculo de cobertura por detalle ────────────────────────
    const detallesConCobertura = detalles.map((d) => {
      if (!obraSocial) {
        // Sin cobertura: el paciente paga el subtotal completo.
        // Se mantiene la invariante subtotal = montoCobertura + montoCopago.
        return {
          ...d,
          montoCobertura: new Prisma.Decimal(0),
          descuentoObraSocial: new Prisma.Decimal(0),
          montoCopago: d.subtotal,
        };
      }

      // Restricción por categoría: si aplica, solo cubre categorías en la lista
      if (
        obraSocial.restriccionPorCategoria &&
        !obraSocial.categoriasCubiertas.includes(d.categoriaTerapeutica)
      ) {
        return {
          ...d,
          montoCobertura: new Prisma.Decimal(0),
          descuentoObraSocial: new Prisma.Decimal(0),
          montoCopago: d.subtotal,
        };
      }

      // Cobertura bruta = subtotal × porcentaje / 100
      let coberturaBruta = d.subtotal
        .mul(obraSocial.porcentajeCobertura)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      // Tope: si tiene tope, la cobertura no puede superar el tope máximo
      if (obraSocial.tieneTope && obraSocial.topeMaximoPorMedicamento != null) {
        if (coberturaBruta.greaterThan(obraSocial.topeMaximoPorMedicamento)) {
          coberturaBruta = obraSocial.topeMaximoPorMedicamento;
        }
      }

      const montoCopago = d.subtotal
        .sub(coberturaBruta)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

      return {
        ...d,
        montoCobertura: coberturaBruta,
        descuentoObraSocial: coberturaBruta,
        montoCopago,
      };
    });

    // ── Totales de la venta ─────────────────────────────────────
    const totalCobertura = detallesConCobertura.reduce(
      (acc, d) => acc.add(d.montoCobertura),
      new Prisma.Decimal(0),
    );
    const totalDescuentos = detallesConCobertura.reduce(
      (acc, d) => acc.add(d.descuentoObraSocial),
      new Prisma.Decimal(0),
    );
    const totalCopago = detallesConCobertura.reduce(
      (acc, d) => acc.add(d.montoCopago),
      new Prisma.Decimal(0),
    );

    const cantidadVentas = await tx.venta.count();
    const numeroVenta = generarNumeroVenta(cantidadVentas);

    const venta = await tx.venta.create({
      data: {
        numeroVenta,
        pacienteId: input.pacienteId ?? null,
        obraSocialId: obraSocial?.id ?? null,
        usuarioId,
        estado: "completada",
        subtotal,
        totalDescuentos,
        totalCobertura,
        totalCopago,
        totalFinal: subtotal.sub(totalCobertura),
        metodoPago: input.metodoPago,
        observaciones: input.observaciones ?? null,
        detalles: {
          create: detallesConCobertura.map((d) => ({
            medicamentoId: d.medicamentoId,
            loteId: d.loteId,
            cantidad: d.cantidad,
            precioUnitario: d.precioUnitario,
            subtotal: d.subtotal,
            descuentoObraSocial: d.descuentoObraSocial,
            montoCobertura: d.montoCobertura,
            montoCopago: d.montoCopago,
          })),
        },
      },
      include: VENTA_COMPLETA.include,
    });

    return venta;
  });
}

/**
 * Lista de ventas paginada con filtro opcional por rango de fechas.
 */
export async function listarVentas(params: {
  limit: number;
  offset: number;
  desde?: string;
  hasta?: string;
}) {
  const where: Prisma.VentaWhereInput = {};

  if (params.desde || params.hasta) {
    where.createdAt = {};
    if (params.desde) where.createdAt.gte = new Date(params.desde);
    if (params.hasta) where.createdAt.lte = new Date(params.hasta);
  }

  const [ventas, total] = await Promise.all([
    prisma.venta.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset,
      include: VENTA_COMPLETA.include,
    }),
    prisma.venta.count({ where }),
  ]);

  return { data: ventas, total, limit: params.limit, offset: params.offset };
}

/**
 * Obtiene una venta por id con todos sus detalles, paciente y usuario.
 */
export async function obtenerVenta(id: string) {
  const venta = await prisma.venta.findUnique({
    where: { id },
    include: VENTA_COMPLETA.include,
  });

  if (!venta) {
    throw new AppError(404, "Venta no encontrada");
  }

  return venta;
}
