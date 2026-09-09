import type { Request, Response } from "express";
import {
  registrarVenta,
  listarVentas,
  obtenerVenta,
  type VentaRegistrada,
} from "../services/venta.service.js";
import type { CreateVentaInput } from "../schemas/venta.schema.js";
import { listVentasQuerySchema } from "../schemas/venta.schema.js";

interface DetalleSerializado {
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

interface VentaSerializada {
  id: string;
  numeroVenta: string;
  estado: string;
  subtotal: number;
  totalDescuentos: number;
  totalCobertura: number;
  totalCopago: number;
  totalFinal: number;
  metodoPago: string;
  observaciones: string | null;
  createdAt: string;
  updatedAt: string;
  pacienteId: string | null;
  obraSocialId: string | null;
  paciente: { nombre: string; documento: string } | null;
  obraSocial: { nombre: string } | null;
  detalles: DetalleSerializado[];
}

/**
 * Convierte una venta de Prisma (con Decimal) en un objeto JSON limpio
 * con todos los montos serializados a number. Sigue el mismo criterio
 * que los controllers existentes (Number() sobre Decimal).
 */
function serializarVenta(venta: VentaRegistrada): VentaSerializada {
  return {
    id: venta.id,
    numeroVenta: venta.numeroVenta,
    estado: venta.estado,
    subtotal: Number(venta.subtotal),
    totalDescuentos: Number(venta.totalDescuentos),
    totalCobertura: Number(venta.totalCobertura),
    totalCopago: Number(venta.totalCopago),
    totalFinal: Number(venta.totalFinal),
    metodoPago: venta.metodoPago,
    observaciones: venta.observaciones,
    createdAt: venta.createdAt.toISOString(),
    updatedAt: venta.updatedAt.toISOString(),
    pacienteId: venta.pacienteId,
    obraSocialId: venta.obraSocialId,
    paciente: venta.paciente
      ? {
          nombre: venta.paciente.nombre,
          documento: venta.paciente.documento,
        }
      : null,
    obraSocial: venta.obraSocial
      ? {
          nombre: venta.obraSocial.nombre,
        }
      : null,
    detalles: venta.detalles.map((d) => ({
      id: d.id,
      cantidad: d.cantidad,
      precioUnitario: Number(d.precioUnitario),
      subtotal: Number(d.subtotal),
      descuentoObraSocial: Number(d.descuentoObraSocial),
      montoCobertura: Number(d.montoCobertura),
      montoCopago: Number(d.montoCopago),
      medicamento: d.medicamento
        ? {
            nombreComercial: d.medicamento.nombreComercial,
            principioActivo: d.medicamento.principioActivo,
          }
        : null,
      lote: d.lote
        ? { numeroLote: d.lote.numeroLote, fechaVencimiento: d.lote.fechaVencimiento.toISOString() }
        : null,
    })),
  };
}

export async function createVenta(
  req: Request<{}, unknown, CreateVentaInput>,
  res: Response,
): Promise<void> {
  const venta = await registrarVenta(req.body, req.userId);
  res.status(201).json(serializarVenta(venta));
}

export async function listVentas(
  req: Request<{}, unknown, unknown>,
  res: Response,
): Promise<void> {
  const { limit, offset, desde, hasta } =
    listVentasQuerySchema.parse(req.query);
  const result = await listarVentas({
    limit,
    offset,
    desde,
    hasta,
  });
  res.json({
    data: result.data.map(serializarVenta),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  });
}

export async function getVenta(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const venta = await obtenerVenta(req.params.id);
  res.json(serializarVenta(venta));
}
