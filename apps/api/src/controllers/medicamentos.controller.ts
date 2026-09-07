import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/error.js";
import { listQuerySchema } from "../schemas/medicamento.schema.js";
import type {
  CreateMedicamentoInput,
  UpdateMedicamentoInput,
} from "../schemas/medicamento.schema.js";

export async function listMedicamentos(req: Request, res: Response): Promise<void> {
  const { q, activo, limit, offset } = listQuerySchema.parse(req.query);

  const where: Record<string, unknown> = {};

  if (q) {
    where.OR = [
      { principioActivo: { contains: q, mode: "insensitive" } },
      { nombreComercial: { contains: q, mode: "insensitive" } },
      { codigoBarras: { contains: q, mode: "insensitive" } },
    ];
  }

  if (activo !== undefined) {
    where.activo = activo === "true";
  }

  const [medicamentos, total] = await Promise.all([
    prisma.medicamento.findMany({
      where,
      orderBy: { principioActivo: "asc" },
      take: limit,
      skip: offset,
    }),
    prisma.medicamento.count({ where }),
  ]);

  res.json({
    data: medicamentos.map((m) => ({
      ...m,
      precioUnitario: Number(m.precioUnitario),
    })),
    total,
    limit,
    offset,
  });
}

export async function getMedicamento(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id } = req.params;

  const medicamento = await prisma.medicamento.findUnique({
    where: { id },
    include: {
      lotes: {
        orderBy: { fechaVencimiento: "asc" },
      },
    },
  });

  if (!medicamento) {
    throw new AppError(404, "Medicamento no encontrado");
  }

  res.json({
    ...medicamento,
    precioUnitario: Number(medicamento.precioUnitario),
    lotes: medicamento.lotes.map((l) => ({
      ...l,
      precioCompra: Number(l.precioCompra),
    })),
  });
}

export async function createMedicamento(
  req: Request<{}, unknown, CreateMedicamentoInput>,
  res: Response,
): Promise<void> {
  const input = req.body;

  const medicamento = await prisma.medicamento.create({
    data: input,
  });

  res.status(201).json({
    ...medicamento,
    precioUnitario: Number(medicamento.precioUnitario),
  });
}

export async function updateMedicamento(
  req: Request<{ id: string }, unknown, UpdateMedicamentoInput>,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  const input = req.body;

  const existing = await prisma.medicamento.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Medicamento no encontrado");
  }

  const medicamento = await prisma.medicamento.update({
    where: { id },
    data: input,
  });

  res.json({
    ...medicamento,
    precioUnitario: Number(medicamento.precioUnitario),
  });
}

export async function deleteMedicamento(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id } = req.params;

  const existing = await prisma.medicamento.findUnique({ where: { id } });

  if (!existing) {
    throw new AppError(404, "Medicamento no encontrado");
  }

  await prisma.medicamento.update({
    where: { id },
    data: { activo: false },
  });

  res.status(204).send();
}
