import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import { listLotesQuerySchema, startOfToday } from "../schemas/lote.schema.js";
import type {
  CreateLoteInput,
  UpdateLoteInput,
} from "../schemas/lote.schema.js";

const MEDICAMENTO_BASICO = {
  select: { nombreComercial: true, principioActivo: true },
} as const;

function deriveEstadoInicial(
  stock: number,
  fechaVencimiento: string,
): "agotado" | "vencido" | "disponible" {
  if (stock === 0) return "agotado";
  if (new Date(fechaVencimiento).getTime() < startOfToday().getTime()) {
    return "vencido";
  }
  return "disponible";
}

/** Date-only (YYYY-MM-DD) → end of day, so "lte" includes the whole day. */
function parseFechaLimite(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T23:59:59.999`);
  }
  return new Date(value);
}

export async function listLotes(req: Request, res: Response): Promise<void> {
  const { medicamentoId, estado, fechaVencimientoLte, limit, offset } =
    listLotesQuerySchema.parse(req.query);

  const where: Prisma.LoteWhereInput = {};

  if (medicamentoId) {
    where.medicamentoId = medicamentoId;
  }

  if (estado) {
    where.estado = estado;
  }

  if (fechaVencimientoLte) {
    where.fechaVencimiento = { lte: parseFechaLimite(fechaVencimientoLte) };
  }

  const [lotes, total] = await Promise.all([
    prisma.lote.findMany({
      where,
      orderBy: { fechaVencimiento: "asc" },
      take: limit,
      skip: offset,
      include: { medicamento: MEDICAMENTO_BASICO },
    }),
    prisma.lote.count({ where }),
  ]);

  res.json({
    data: lotes.map((lote) => ({
      ...lote,
      precioCompra: Number(lote.precioCompra),
    })),
    total,
    limit,
    offset,
  });
}

export async function getLote(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id } = req.params;

  const lote = await prisma.lote.findUnique({
    where: { id },
    include: { medicamento: MEDICAMENTO_BASICO },
  });

  if (!lote) {
    throw new AppError(404, "Lote no encontrado");
  }

  res.json({
    ...lote,
    precioCompra: Number(lote.precioCompra),
  });
}

export async function createLote(
  req: Request<{}, unknown, CreateLoteInput>,
  res: Response,
): Promise<void> {
  const input = req.body;

  const medicamento = await prisma.medicamento.findUnique({
    where: { id: input.medicamentoId },
  });

  if (!medicamento) {
    throw new AppError(404, "Medicamento no encontrado");
  }

  const duplicado = await prisma.lote.findFirst({
    where: {
      medicamentoId: input.medicamentoId,
      numeroLote: input.numeroLote,
    },
  });

  if (duplicado) {
    throw new AppError(
      409,
      "Ya existe un lote con ese número para este medicamento",
    );
  }

  const lote = await prisma.lote.create({
    data: {
      medicamentoId: input.medicamentoId,
      numeroLote: input.numeroLote,
      fechaVencimiento: input.fechaVencimiento,
      fechaFabricacion: input.fechaFabricacion,
      stock: input.stock,
      stockInicial: input.stock,
      precioCompra: input.precioCompra,
      proveedor: input.proveedor,
      numeroFactura: input.numeroFactura ?? null,
      estado: deriveEstadoInicial(input.stock, input.fechaVencimiento),
    },
    include: { medicamento: MEDICAMENTO_BASICO },
  });

  res.status(201).json({
    ...lote,
    precioCompra: Number(lote.precioCompra),
  });
}

export async function updateLote(
  req: Request<{ id: string }, unknown, UpdateLoteInput>,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  const input = req.body;

  const existing = await prisma.lote.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Lote no encontrado");
  }

  const enviaVencimiento = input.fechaVencimiento !== undefined;
  const enviaFabricacion = input.fechaFabricacion !== undefined;

  if (enviaVencimiento || enviaFabricacion) {
    const vencimientoEfectivo =
      input.fechaVencimiento ?? existing.fechaVencimiento.toISOString();
    const fabricacionEfectiva =
      input.fechaFabricacion ?? existing.fechaFabricacion.toISOString();

    if (
      enviaVencimiento &&
      new Date(vencimientoEfectivo).getTime() < startOfToday().getTime()
    ) {
      throw new AppError(
        400,
        "La fecha de vencimiento debe ser hoy o una fecha futura",
      );
    }

    if (
      new Date(fabricacionEfectiva).getTime() >
      new Date(vencimientoEfectivo).getTime()
    ) {
      throw new AppError(
        400,
        "La fecha de fabricación debe ser anterior o igual a la fecha de vencimiento",
      );
    }
  }

  const lote = await prisma.lote.update({
    where: { id },
    data: {
      numeroLote: input.numeroLote,
      fechaVencimiento: input.fechaVencimiento,
      fechaFabricacion: input.fechaFabricacion,
      proveedor: input.proveedor,
      numeroFactura: input.numeroFactura,
      precioCompra: input.precioCompra,
    },
    include: { medicamento: MEDICAMENTO_BASICO },
  });

  res.json({
    ...lote,
    precioCompra: Number(lote.precioCompra),
  });
}

export async function deleteLote(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id } = req.params;

  const existing = await prisma.lote.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Lote no encontrado");
  }

  // Soft-delete: the lot stays in history for traceability.
  await prisma.lote.update({
    where: { id },
    data: { estado: "retirado" },
  });

  res.status(204).send();
}